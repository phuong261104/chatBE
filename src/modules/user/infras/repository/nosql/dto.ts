import { Schema, model } from 'mongoose';
import { UserStatus } from '@modules/user/model/model';

interface IUserDocument {
  _id: string;

  // Identity
  email?: string;
  phone?: string;
  username?: string;

  // Authentication
  password: string;
  salt: string;
  status: UserStatus;
  verified: {
    email: boolean;
    phone: boolean;
  };

  // Profile
  displayName?: string;
  avatarUrl?: string;
  bio?: string;

  // Privacy
  privacy: {
    searchableByEmail: boolean;
    searchableByPhone: boolean;
    searchableByUsername: boolean;
  };

  // Preferences
  settings: {
    notifications: {
      push: boolean;
      inApp: boolean;
    };
  };

  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    _id: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true
    },
    username: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    salt: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      required: true,
      default: UserStatus.ACTIVE
    },
    verified: {
      email: {
        type: Boolean,
        required: true,
        default: false
      },
      phone: {
        type: Boolean,
        required: true,
        default: false
      }
    },
    displayName: {
      type: String,
      required: false
    },
    avatarUrl: {
      type: String,
      required: false
    },
    bio: {
      type: String,
      required: false
    },
    privacy: {
      searchableByEmail: {
        type: Boolean,
        required: true,
        default: true
      },
      searchableByPhone: {
        type: Boolean,
        required: true,
        default: true
      },
      searchableByUsername: {
        type: Boolean,
        required: true,
        default: true
      }
    },
    settings: {
      notifications: {
        push: {
          type: Boolean,
          required: true,
          default: true
        },
        inApp: {
          type: Boolean,
          required: true,
          default: true
        }
      }
    },
    lastLoginAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ username: 1 });

export const UserModel = model<IUserDocument>('User', UserSchema);

export const modelName = 'User';
