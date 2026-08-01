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
| Throughput | 89158 req/s |
| p95 | 11.577 ms |
| p99 | 14.683 ms |
| ELU | 99.11% |
| RSS peak | 81.59 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 27506.101 |
| instructions:u | 36412.593 |
| branches:u | 7373.657 |
| branch-misses:u | 29.645 |
| cache-references:u | 436.703 |
| cache-misses:u | 0.066 |
