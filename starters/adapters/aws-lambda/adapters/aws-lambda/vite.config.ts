import { nodeServerAdapter } from "@qwikdev/city/adapters/node-server/vite";
import { extendConfig } from "@qwikdev/city/vite";
import { builtinModules } from "module";
import baseConfig from "../../vite.config";
export default extendConfig(baseConfig, () => {
  return {
    ssr: {
      // This configuration will bundle all dependencies, except the node builtins (path, fs, etc.)
      external: builtinModules,
      noExternal: /./,
    },
    build: {
      minify: false,
      ssr: true,
      rollupOptions: {
        input: ["./src/entry_aws-lambda.tsx", "@qwik-city-plan"],
      },
    },
    plugins: [nodeServerAdapter({ name: "aws-lambda" })],
  };
});
