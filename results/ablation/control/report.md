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
| Throughput | 122429 req/s |
| p95 | 8.433 ms |
| p99 | 15.893 ms |
| ELU | 99.09% |
| RSS peak | 80.09 MiB |
| Errors | 0 |

| Hardware counter | Per request |
| --- | ---: |
| cycles:u | 19087.988 |
| instructions:u | 25429.597 |
| branches:u | 5391.351 |
| branch-misses:u | 31.370 |
| cache-references:u | 321.221 |
| cache-misses:u | 0.047 |
