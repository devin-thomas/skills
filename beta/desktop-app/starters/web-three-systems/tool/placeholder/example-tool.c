/*
 * The placeholder for the app's bundled tool. It is a real executable, so the
 * packager, the installers and the installed checks have something to carry on
 * every system before the real tool exists. It answers --capabilities with the
 * schema "example-placeholder", which the app reads as a damaged installation
 * (docs/TOOL-CONTRACT.md), and refuses every job with one error event. It does
 * nothing else and reads nothing.
 *
 * Build, one binary per system and processor (tool/placeholder/README.md):
 *   macOS    cc -O2 -arch arm64 -arch x86_64 -o example-tool example-tool.c
 *   Linux    cc -O2 -static -o example-tool example-tool.c     (musl in an Alpine container)
 *   Windows  cl /O2 /MT /Brepro example-tool.c /Fe:example-tool.exe
 */
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
  int events = 0;
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--capabilities") == 0) {
      fputs("{\"schema\":\"example-placeholder\",\"schema_version\":\"1.0\",\"tool\":\"example-tool\",\"tool_version\":\"0.0.0\",\"events\":[]}\n", stdout);
      return 0;
    }
    if (strcmp(argv[i], "--events") == 0) events = 1;
  }
  if (events) {
    fputs("{\"type\":\"hello\",\"seq\":0,\"t_ms\":0,\"schema\":\"example-events\",\"schema_version\":\"1.0\",\"tool\":\"example-tool\",\"tool_version\":\"0.0.0\",\"pid\":0}\n", stdout);
    fputs("{\"type\":\"error\",\"seq\":1,\"t_ms\":0,\"code\":\"INTERNAL\",\"message\":\"this is the placeholder tool\",\"details\":{}}\n", stdout);
  } else {
    fputs("example-tool: this is the placeholder; build the real tool\n", stderr);
  }
  return 1;
}
