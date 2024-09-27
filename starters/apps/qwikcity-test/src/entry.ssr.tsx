import { manifest } from "@qwik-client-manifest";
import {
  renderToStream,
  type RenderToStreamOptions,
} from "@qwikdev/core/server";
import Root from "./root";

export default function (opts: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    manifest,
    base: "/qwikcity-test/build/",
    ...opts,
  });
}
