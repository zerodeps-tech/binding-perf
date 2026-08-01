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
| Throughput | 104223 req/s |
| p95 | 9.881 ms |
| p99 | 12.045 ms |
| ELU | 99.14% |
| RSS peak | 80.81 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 23402.208 |
| instructions:u | 30745.395 |
| branches:u | 6313.435 |
| branch-misses:u | 23.198 |
| cache-references:u | 403.840 |
| cache-misses:u | 0.058 |
