# snapshot mixed JS/C++ CPU profile

| Parameter | Value |
| --- | ---: |
| Warmup | 30s |
| Duration | 30s per perf phase |
| Connections | 100 |
| Pipelining | 10 |
| Server CPU | 2 |
| Client CPUs | 3-6 |

| Result | Value |
| --- | ---: |
| Throughput | 81229 req/s |
| p95 | 12.782 ms |
| p99 | 14.395 ms |
| ELU | 99.14% |
| RSS peak | 71.90 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 29832.479 |
| instructions:u | 36457.868 |
| branches:u | 7387.094 |
| branch-misses:u | 28.854 |
| cache-references:u | 524.726 |
| cache-misses:u | 0.069 |
