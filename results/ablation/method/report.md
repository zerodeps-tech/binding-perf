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
| Throughput | 94677 req/s |
| p95 | 10.909 ms |
| p99 | 19.761 ms |
| ELU | 99.13% |
| RSS peak | 72.41 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 25480.843 |
| instructions:u | 31140.347 |
| branches:u | 6396.574 |
| branch-misses:u | 23.317 |
| cache-references:u | 523.800 |
| cache-misses:u | 0.051 |
