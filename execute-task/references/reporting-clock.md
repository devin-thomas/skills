# Reporting Clock

Resolve time-zone evidence carefully. Do not infer a user's zone from locale, language, IP address, profile, assistant defaults, or repository location.

## Precedence

1. Use a zone explicitly required by the canonical prompt.
2. Otherwise use explicit repository policy.
3. Otherwise use the user's explicit preference.
4. Otherwise query the operating system's configured time zone.

## OS-native discovery

Use the host's native setting and clock rather than a generic automatic picker:

- Windows: query `Get-TimeZone` and capture `[DateTimeOffset]::Now` plus `[DateTimeOffset]::UtcNow`.
- Linux: query `timedatectl show -p Timezone --value` when available; corroborate with `/etc/localtime` or `/etc/timezone` and a local timestamp with numeric offset.
- macOS: query the system time-zone setting when available; corroborate with `/etc/localtime` and a local timestamp with numeric offset.

Do not require elevated access merely to name the zone. Do not translate between Windows and IANA identifiers unless a consuming tool requires it; retain the OS identifier in the report.

## Validate and capture

At pass start, capture:

- zone identifier and source;
- local ISO-8601 timestamp including numeric UTC offset;
- UTC timestamp;
- current offset.

Cross-check that local time, UTC time, and the offset agree. Record elapsed time from UTC instants or a monotonic clock, not by subtracting local wall-clock display values.

At pass end, repeat OS-native discovery and capture. This allows daylight-saving or configuration changes during a long task to appear honestly.

## Detect anomalies

Treat any of these as anomalous:

- the OS-native query fails;
- the identifier is missing or unknown;
- independent OS sources disagree;
- the rendered timestamp and offset disagree with the OS clock;
- only a fixed numeric offset can be verified;
- the zone changes unexpectedly during the pass.

Do not interrupt preflight or implementation for a reporting-clock anomaly. Preserve the evidence.

## Report

When resolution is healthy, report start and end in the verified named zone with numeric offsets and report elapsed time.

When anomalous, report start and end with the verified numeric offsets, explain the anomaly briefly, and include this question in the final report: `Which named time zone should future task reports use?`

Never silently choose a city or named zone as a fallback.
