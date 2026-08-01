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
| Throughput | 109799 req/s |
| p95 | 9.311 ms |
| p99 | 17.203 ms |
| ELU | 99.12% |
| RSS peak | 80.81 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 21533.985 |
| instructions:u | 26119.170 |
| branches:u | 5351.836 |
| branch-misses:u | 21.069 |
| cache-references:u | 428.726 |
| cache-misses:u | 0.052 |
