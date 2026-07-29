import {
  ALL_TABLES,
  TABLE_NAMES,
} from "@share/repository/dynamodb/table-defs";

describe("DynamoDB table definitions", () => {
  it("includes every table required by block relationships and chat drafts", () => {
    const tableNames = new Set(ALL_TABLES.map((table) => table.TableName));

    expect(tableNames).toContain(TABLE_NAMES.BLOCKS);
    expect(tableNames).toContain(TABLE_NAMES.GROUP_BLOCKS);
    expect(tableNames).toContain(TABLE_NAMES.DRAFTS);
  });
});
