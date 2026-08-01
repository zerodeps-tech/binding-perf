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
| Throughput | 98835 req/s |
| p95 | 10.280 ms |
| p99 | 12.286 ms |
| ELU | 99.13% |
| RSS peak | 80.24 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 24563.362 |
| instructions:u | 33496.380 |
| branches:u | 6636.991 |
| branch-misses:u | 27.146 |
| cache-references:u | 451.603 |
| cache-misses:u | 0.049 |
