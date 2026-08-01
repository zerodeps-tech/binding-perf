# control mixed JS/C++ CPU profile

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
| Throughput | 142390 req/s |
| p95 | 7.198 ms |
| p99 | 9.881 ms |
| ELU | 99.08% |
| RSS peak | 80.77 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 16112.201 |
| instructions:u | 22709.352 |
| branches:u | 4697.146 |
| branch-misses:u | 27.575 |
| cache-references:u | 269.412 |
| cache-misses:u | 0.045 |
