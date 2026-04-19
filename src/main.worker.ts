/// <reference lib="WebWorker" />

import { COMPILE_ARGS, FILE_PATH, WORKSPACE_PATH } from "./config";
import { JsonStream } from "./json_stream";
import { BrowserMessageReader, BrowserMessageWriter} from "vscode-languageserver/browser";

declare var self: DedicatedWorkerGlobalScope;
const wasmBase = `${import.meta.env.BASE_URL}wasm/`;
const wasmUrl = `https://clangd.guyutongxue.site/wasm/clangd.wasm`;
const jsModule = import(  /* @vite-ignore */ `${wasmBase}clangd.js`);
// Pre-fetch wasm, and report progress to main
const wasmResponse = await fetch(wasmUrl);
const wasmSize = __WASM_SIZE__;
const wasmReader = wasmResponse.body!.getReader();
let receivedLength = 0;
let chunks: Uint8Array[] = [];
while (true) {
  const { done, value } = await wasmReader.read();
  if (done) {
    break;
  }
  if (value) {
    chunks.push(value);
    receivedLength += value.length;
    self.postMessage({
      type: "progress",
      value: receivedLength,
      max: Number(wasmSize),
    });
  }
}
const wasmBlob = new Blob(chunks, { type: "application/wasm" });
const wasmDataUrl = URL.createObjectURL(wasmBlob);

const { default: Clangd } = await jsModule;

const textEncoder = new TextEncoder();
let resolveStdinReady = () => {};
const stdinChunks: string[] = [];
const currentStdinChunk: (number | null)[] = [];

const stdin = (): number | null => {
  if (currentStdinChunk.length === 0) {
    if (stdinChunks.length === 0) {
      // Should not reach here
      // stdinChunks.push("Content-Length: 0\r\n", "\r\n");
      console.error("Try to fetch exhausted stdin");
      return null;
    }
    const nextChunk = stdinChunks.shift()!;
    currentStdinChunk.push(...textEncoder.encode(nextChunk), null);
  }
  return currentStdinChunk.shift()!;
};

const LF = 10;
const jsonStream = new JsonStream();

const stdout = (charCode: number) => {
  const jsonOrNull = jsonStream.insert(charCode);
  if (jsonOrNull !== null) {
    // console.log("%c%s", "color: green", jsonOrNull);
    writer.write(JSON.parse(jsonOrNull));
  }
};

let stderrLine = "";
const stderr = (charCode: number) => {
  // if (charCode === LF) {
  //   console.log("%c%s", "color: darkorange", stderrLine);
  //   stderrLine = "";
  // } else {
  //   stderrLine += String.fromCharCode(charCode);
  // }
};

const stdinReady = async () => {
  if (stdinChunks.length === 0) {
    return new Promise<void>((r) => (resolveStdinReady = r));
  }
};

const onAbort = () => {
  writer.end();
  self.reportError("clangd aborted");
};

const clangd = await Clangd({
  thisProgram: "/usr/bin/clangd",
  locateFile: (path: string, prefix: string) => {
    return path.endsWith(".wasm") ? wasmDataUrl : `${prefix}${path}`;
  },
  stdinReady,
  stdin,
  stdout,
  stderr,
  onExit: onAbort,
  onAbort,
});
console.log(clangd);

const flags = [
  ...COMPILE_ARGS,
  "--target=wasm32-wasi",
  "-isystem/usr/include/c++/v1",
  "-isystem/usr/include/wasm32-wasi/c++/v1",
  "-isystem/usr/include",
  "-isystem/usr/include/wasm32-wasi",
];

clangd.FS.writeFile(FILE_PATH, "");

// Add bits/stdc++.h
clangd.FS.mkdir("/usr/include/bits");
clangd.FS.writeFile("/usr/include/bits/stdc++.h", `// C++ includes used for precompiling -*- C++ -*-

// Copyright (C) 2003-2015 Free Software Foundation, Inc.
//
// This file is part of the GNU ISO C++ Library.  This library is free
// software; you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the
// Free Software Foundation; either version 3, or (at your option)
// any later version.

// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// Under Section 7 of GPL version 3, you are granted additional
// permissions described in the GCC Runtime Library Exception, version
// 3.1, as published by the Free Software Foundation.

// You should have received a copy of the GNU General Public License and
// a copy of the GCC Runtime Library Exception along with this program;
// see the files COPYING3 and COPYING.RUNTIME respectively.  If not, see
// <http://www.gnu.org/licenses/>.

/** @file stdc++.h
 *  This is an implementation file for a precompiled header.
 */

// 17.4.1.2 Headers

// C
#ifndef _GLIBCXX_NO_ASSERT
#include <cassert>
#endif
#include <cctype>
#include <cerrno>
#include <cfloat>
#include <ciso646>
#include <climits>
#include <clocale>
#include <cmath>
#include <csignal>
#include <cstdarg>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>

#if __cplusplus >= 201103L
#include <ccomplex>
#include <cfenv>
#include <cinttypes>
#include <cstdalign>
#include <cstdbool>
#include <cstdint>
#include <ctgmath>
#include <cwchar>
#include <cwctype>
#endif

// C++
#include <algorithm>
#include <bitset>
#include <complex>
#include <deque>
#include <exception>
#include <fstream>
#include <functional>
#include <iomanip>
#include <ios>
#include <iosfwd>
#include <iostream>
#include <istream>
#include <iterator>
#include <limits>
#include <list>
#include <locale>
#include <map>
#include <memory>
#include <new>
#include <numeric>
#include <ostream>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <stdexcept>
#include <streambuf>
#include <string>
#include <typeinfo>
#include <utility>
#include <valarray>
#include <vector>

#if __cplusplus >= 201103L
#include <array>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <forward_list>
#include <future>
#include <initializer_list>
#include <mutex>
#include <random>
#include <ratio>
#include <regex>
#include <scoped_allocator>
#include <system_error>
#include <thread>
#include <tuple>
#include <typeindex>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#endif
`);

clangd.FS.writeFile(
  `${WORKSPACE_PATH}/.clangd`,
  JSON.stringify({ CompileFlags: { Add: flags } })
);

function startServer() {
  console.log("%c%s", "font-size: 2em; color: green", "clangd started");
  clangd.callMain([]);
}
startServer();

self.postMessage({ type: "ready" });

const reader = new BrowserMessageReader(self);
const writer = new BrowserMessageWriter(self);

reader.listen((data) => {
  // non-ASCII characters cause bad Content-Length. Just escape them.
  const body = JSON.stringify(data).replace(/[\u007F-\uFFFF]/g, (ch) => {
    return "\\u" + ch.codePointAt(0)!.toString(16).padStart(4, "0");
  });
  const header = `Content-Length: ${body.length}\r\n`;
  const delimiter = "\r\n";
  stdinChunks.push(header, delimiter, body);
  resolveStdinReady();
  // console.log("%c%s", "color: red", `${header}${delimiter}${body}`);
});
