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
| Throughput | 88881 req/s |
| p95 | 11.577 ms |
| p99 | 13.565 ms |
| ELU | 99.12% |
| RSS peak | 79.86 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 27707.936 |
| instructions:u | 36484.850 |
| branches:u | 7388.067 |
| branch-misses:u | 28.612 |
| cache-references:u | 475.451 |
| cache-misses:u | 0.056 |
