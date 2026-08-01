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
| Throughput | 139043 req/s |
| p95 | 7.342 ms |
| p99 | 11.350 ms |
| ELU | 99.13% |
| RSS peak | 71.73 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 16416.170 |
| instructions:u | 21402.775 |
| branches:u | 4556.415 |
| branch-misses:u | 20.060 |
| cache-references:u | 304.902 |
| cache-misses:u | 0.047 |
