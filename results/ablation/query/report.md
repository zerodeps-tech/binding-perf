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
| Throughput | 98057 req/s |
| p95 | 10.486 ms |
| p99 | 13.038 ms |
| ELU | 99.12% |
| RSS peak | 73.06 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 25216.329 |
| instructions:u | 31522.182 |
| branches:u | 6482.836 |
| branch-misses:u | 25.041 |
| cache-references:u | 378.999 |
| cache-misses:u | 0.054 |
