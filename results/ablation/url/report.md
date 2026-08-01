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
| Throughput | 99968 req/s |
| p95 | 10.280 ms |
| p99 | 12.782 ms |
| ELU | 99.12% |
| RSS peak | 80.43 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 24679.209 |
| instructions:u | 31542.340 |
| branches:u | 6483.323 |
| branch-misses:u | 25.694 |
| cache-references:u | 449.718 |
| cache-misses:u | 0.055 |
