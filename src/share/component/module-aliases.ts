import path from "path";
import moduleAlias = require("module-alias");

const runtimeRoot = path.resolve(__dirname, "../..");

moduleAlias.addAliases({
  "@root": runtimeRoot,
  "@modules": path.join(runtimeRoot, "modules"),
  "@share": path.join(runtimeRoot, "share"),
});
