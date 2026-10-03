import {
  cp,
  mkdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";

const scriptDir =
  path.dirname(
    fileURLToPath(import.meta.url)
  );

const mobileDir =
  path.resolve(
    scriptDir,
    ".."
  );

const sourceDir =
  path.resolve(
    mobileDir,
    "../front"
  );

const targetDir =
  path.join(
    mobileDir,
    "www"
  );

const DEFAULT_API_ORIGIN =
  "https://astra-ep6m.onrender.com";

function normalizeApiOrigin(value) {
  const raw =
    String(
      value ||
      DEFAULT_API_ORIGIN
    )
      .trim()
      .replace(/\/+$/, "");

  if (!raw) {
    throw new Error(
      "OVLL_API_ORIGIN이 필요합니다. 예: https://api.example.com"
    );
  }

  const parsed =
    new URL(raw);

  if (parsed.protocol !== "https:") {
    throw new Error(
      "네이티브 앱 API는 HTTPS origin을 사용해야 합니다."
    );
  }

  if (
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "OVLL_API_ORIGIN에는 origin만 넣어주세요. 예: https://api.example.com"
    );
  }

  return parsed.origin;
}

const apiOrigin =
  normalizeApiOrigin(
    process.env.OVLL_API_ORIGIN
  );

await rm(
  targetDir,
  {
    recursive: true,
    force: true
  }
);

await mkdir(
  targetDir,
  {
    recursive: true
  }
);

await cp(
  sourceDir,
  targetDir,
  {
    recursive: true
  }
);

const runtimeConfig =
`(function(global){
"use strict";

global.OVLL_RUNTIME=
  Object.freeze({
    native:true,
    apiOrigin:${JSON.stringify(apiOrigin)}
  });

})(window);
`;

await writeFile(
  path.join(
    targetDir,
    "runtime-config.js"
  ),
  runtimeConfig,
  "utf8"
);

console.log(
  `Prepared Capacitor web assets -> ${targetDir}`
);
console.log(
  `Native API origin -> ${apiOrigin}`
);
