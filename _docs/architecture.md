# Cart Module Example - Architecture Documentation

## Tổng quan

Cart Module được xây dựng theo **\*Hexagonal Architecture**, đảm bảo tách biệt các layer và dễ dàng thay đổi implementation mà không ảnh hưởng đến business logic.

## Cấu trúc thư mục

```
cart/
├── index.ts                      # Module entry point & dependency injection
├── model/                        # Domain models & DTOs
│   ├── index.ts                 # CartItem, CartProduct models (Zod schemas)
│   └── error.ts                 # Domain-specific errors
├── interface/                    # Contracts/Interfaces
│   └── index.ts                 # ICartUseCase, ICartQueryRepository, etc.
├── usecase/                      # Business logic
│   └── index.ts                 # CartUseCase implementation
└── infras/                       # Infrastructure implementations
    ├── repository/
    │   ├── mysql/               # MySQL implementation
    │   │   ├── dto.ts           # Sequelize model definition
    │   │   └── index.ts         # CartRepository implementation
    │   └── rpc/                 # External service communication
    │       └── index.ts         # Product RPC repository
    └── transport/
        └── http-service.ts      # HTTP handlers (API endpoints)
```

## Kiến trúc các Layer

### 1. Model Layer (`model/`)

**Mục đích**: Định nghĩa domain models, DTOs và validation schemas

**Nội dung**:

- `CartItem`: Model chính của cart item
- `CartProduct`: Duplicate model từ Product module (không import trực tiếp)
- DTOs: `AddCartItemDTO`, `CartItemCondDTO`, `UpdateCartItemDTO`
- Sử dụng **Zod** để validation và type inference

```typescript
// Example
export const cartItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  attribute: z.string().nullable().optional().default(""),
  quantity: z.number().min(1),
  product: cartProductSchema.optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;
```

**Đặc điểm**:

- Không phụ thuộc vào bất kỳ layer nào khác
- Pure TypeScript/JavaScript
- Domain-driven

---

### 2. Interface Layer (`interface/`)

**Mục đích**: Định nghĩa contracts (interfaces) cho tất cả các dependencies

**Các interfaces chính**:

#### `ICartUseCase`

Business logic interface - định nghĩa các use cases chính:

```typescript
interface ICartUseCase {
  addProductToCart(dto: AddCartItemDTO): Promise<boolean>;
  removeProductFromCart(id: string, requesterId: string): Promise<boolean>;
  updateProductQuantities(
    dto: UpdateCartItemDTO[],
    requesterId: string,
  ): Promise<boolean>;
}
```

#### `ICartQueryRepository`

Read operations từ database:

```typescript
interface ICartQueryRepository {
  get(id: string): Promise<CartItem | null>;
  listItems(userId: string): Promise<Array<CartItem>>;
  findByCond(cond: CartItemCondDTO): Promise<CartItem | null>;
}
```

#### `ICartCommandRepository`

Write operations vào database:

```typescript
interface ICartCommandRepository {
  insert(data: CartItem): Promise<boolean>;
  update(id: string, data: CartItem): Promise<boolean>;
  updateMany(dto: UpdateCartItemDTO[], userId: string): Promise<boolean>;
  remove(id: string, isHard: boolean): Promise<boolean>;
}
```

#### `IProductQueryRepository`

External service dependency (Product service):

```typescript
interface IProductQueryRepository {
  findById(id: string): Promise<CartProduct | null>;
  findByIds(ids: string[]): Promise<Array<CartProduct>>;
}
```

**Đặc điểm**:

- Chỉ phụ thuộc vào Model layer
- Định nghĩa contract cho Dependency Inversion Principle
- Cho phép dễ dàng mock/stub trong testing

---

### 3. Use Case Layer (`usecase/`)

**Mục đích**: Chứa business logic của application

**CartUseCase** implements `ICartUseCase`:

#### Flow xử lý `addProductToCart`:

```
1. Validate input DTO (Zod)
2. Kiểm tra product tồn tại (via IProductQueryRepository)
3. Kiểm tra cart item đã tồn tại chưa (via ICartQueryRepository)
4. Nếu tồn tại:
   - Cộng thêm quantity
   - Check product quantity còn đủ không
   - Update cart item (via ICartCommandRepository)
5. Nếu chưa tồn tại:
   - Check product quantity có đủ không
   - Insert cart item mới (via ICartCommandRepository)
```

#### Flow xử lý `removeProductFromCart`:

```
1. Get cart item by id
2. Kiểm tra item có thuộc về user này không (permission check)
3. Remove item (hard delete)
```

#### Flow xử lý `updateProductQuantities`:

```
1. Validate tất cả DTOs
2. Lấy thông tin products (batch)
3. Check tất cả quantities có đủ không
4. Update many items trong transaction
```

**Đặc điểm**:

- Chỉ phụ thuộc vào Model và Interface layers
- Không biết về implementation details (MySQL, MongoDB, etc.)
- Pure business logic
- Dependency injection qua constructor

---

### 4. Infrastructure Layer (`infras/`)

#### 4.1. Repository Layer (`infras/repository/`)

##### MySQL Implementation (`mysql/`)

**CartRepository** implements cả `ICartQueryRepository` và `ICartCommandRepository`:

```typescript
class CartRepository implements ICartQueryRepository, ICartCommandRepository {
  constructor(
    readonly sequelize: Sequelize,
    readonly modelName: string,
  ) {}

  // Implementation methods...
}
```

**Đặc điểm**:

- Sử dụng Sequelize ORM
- Data mapping: `created_at` ↔ `createdAt`, `updated_at` ↔ `updatedAt`
- Transaction support trong `updateMany`
- Convert persistence model → domain model

**Sequelize Model** (`dto.ts`):

```typescript
CartItemPersistence.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, field: "user_id" },
    productId: { type: DataTypes.STRING, field: "product_id" },
    attribute: { type: DataTypes.STRING, allowNull: true, defaultValue: "" },
    quantity: { type: DataTypes.NUMBER, defaultValue: 1 },
  },
  {
    tableName: "carts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
```

##### RPC Repository (`rpc/`)

**CartProductRPCRepo** implements `IProductQueryRepository`:

```typescript
class CartProductRPCRepo implements IProductQueryRepository {
  constructor(private readonly productServiceUrl: string) {}

  async findById(id: string): Promise<CartProduct | null> {
    // HTTP call to Product service
    // Data mapping/adapter pattern
  }
}
```

**Đặc điểm**:

- Giao tiếp với Product service qua HTTP/RPC
- Data adapter: Product model → CartProduct model
- Error handling cho network failures

#### 4.2. Transport Layer (`infras/transport/`)

**CartHTTPService** - HTTP API handlers:

```typescript
class CartHTTPService {
  constructor(
    private readonly cartUseCase: ICartUseCase,
    private readonly cartQueryRepo: ICartQueryRepository,
    private readonly productQueryRepo: IProductQueryRepository,
  ) {}

  async addProductToCartAPI(req: Request, res: Response) {
    /* ... */
  }
  async removeProductFromCartAPI(req: Request, res: Response) {
    /* ... */
  }
  async updateProductQuantitiesAPI(req: Request, res: Response) {
    /* ... */
  }
  async listItemsAPI(req: Request, res: Response) {
    /* ... */
  }
  async listItemsRPC(req: Request, res: Response) {
    /* ... */
  } // For other services
}
```

**Đặc điểm**:

- Extract user info từ `res.locals.requester` (từ auth middleware)
- Request/Response mapping
- Combine data từ nhiều nguồn (cart items + product details)
- Cả REST API và RPC endpoints

---

### 5. Dependency Injection (`index.ts`)

**setupCartHexagon** function:

```typescript
export function setupCartHexagon(
  sequelize: Sequelize,
  sctx: ServiceContext,
): Router {
  // 1. Initialize infrastructure
  init(sequelize); // Sequelize model init

  // 2. Create repository instances
  const cartRepository = new CartRepository(sequelize, modelName);
  const productRPCRepository = new CartProductRPCRepo(config.rpc.product);

  // 3. Create use case with dependencies
  const cartUseCase = new CartUseCase(
    cartRepository, // ICartQueryRepository
    cartRepository, // ICartCommandRepository
    productRPCRepository, // IProductQueryRepository
  );

  // 4. Create HTTP service
  const cartHttpService = new CartHTTPService(
    cartUseCase,
    cartRepository,
    productRPCRepository,
  );

  // 5. Setup routes
  const router = Router();
  router.get(
    "/carts",
    mdlFactory.auth,
    cartHttpService.listItemsAPI.bind(cartHttpService),
  );
  router.post(
    "/carts",
    mdlFactory.auth,
    cartHttpService.addProductToCartAPI.bind(cartHttpService),
  );
  router.patch(
    "/carts",
    mdlFactory.auth,
    cartHttpService.updateProductQuantitiesAPI.bind(cartHttpService),
  );
  router.delete(
    "/carts/:id",
    mdlFactory.auth,
    cartHttpService.removeProductFromCartAPI.bind(cartHttpService),
  );
  router.post(
    "/rpc/carts/items",
    cartHttpService.listItemsRPC.bind(cartHttpService),
  );

  return router;
}
```

**Đặc điểm**:

- Single entry point cho module
- Manual dependency injection
- Wiring tất cả dependencies
- Return Express Router

---

## Flow dữ liệu (Data Flow)

### Request Flow (Add Product to Cart):

```
HTTP Request
    ↓
[Auth Middleware] → Extract user info → res.locals.requester
    ↓
[CartHTTPService.addProductToCartAPI]
    ↓ Call use case
[CartUseCase.addProductToCart]
    ↓ Check product exists
[ProductRPCRepo.findById] → HTTP call → Product Service
    ↓ Check existing item
[CartRepository.findByCond] → SELECT query → MySQL
    ↓ Insert or Update
[CartRepository.insert/update] → INSERT/UPDATE query → MySQL
    ↓ Return
HTTP Response
```

### Query Flow (List Cart Items):

```
HTTP Request
    ↓
[Auth Middleware]
    ↓
[CartHTTPService.listItemsAPI]
    ↓ Query cart items
[CartRepository.listItems] → SELECT query → MySQL
    ↓ Get product details (batch)
[ProductRPCRepo.findByIds] → HTTP call → Product Service
    ↓ Merge data (item + product)
Map items with products
    ↓
HTTP Response (with full product details)
```

---

## Design Patterns được sử dụng

1. **Dependency Injection**: Constructor injection cho tất cả dependencies
2. **Repository Pattern**: Tách biệt data access logic
3. **Adapter Pattern**: Convert external models → domain models (RPC repo)
4. **CQRS-lite**: Tách Query và Command repositories
5. **Factory Pattern**: setupCartHexagon function
6. **Service Layer Pattern**: UseCase layer chứa business logic

---

## Ưu điểm của kiến trúc này

1. **Testability**: Dễ dàng mock dependencies
2. **Maintainability**: Mỗi layer có trách nhiệm rõ ràng
3. **Flexibility**: Dễ thay đổi implementation (SQL → NoSQL)
4. **Scalability**: Dễ mở rộng thêm use cases
5. **Independence**: Business logic không phụ thuộc vào framework/database
