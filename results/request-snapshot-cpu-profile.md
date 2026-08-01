# requestSnapshot CPU profile

Diagnostic profile for the published packages:

- Node.js 24.17.0;
- `@swarmmachina/swm-core` 4.1.1;
- `@swarmmachina/swm-uws` 0.5.7;
- Intel Xeon E5-2680 v4, Linux x86_64;
- async GET `/base-async`, 100 connections, pipelining 10;
- 30s warmup, 30s `perf stat`, 30s `perf record`.

Unlike the main triad benchmark, these are two sequential diagnostic runs.
Use them to explain direction and CPU work, not as the canonical throughput
comparison.

| Metric per request | Control | requestSnapshot | Change |
| --- | ---: | ---: | ---: |
| Instructions | 22,709 | 33,496 | +47.5% |
| CPU cycles | 16,112 | 24,563 | +52.4% |
| Branches | 4,697 | 6,637 | +41.3% |
| Cache references | 269 | 452 | +67.6% |

The server stayed close to one full CPU core in both runs. Throughput fell from
142,390 to 98,835 req/s while p95 rose from 7.20 to 10.28 ms. The candidate is
executing materially more work per request; the benchmark regression is not a
load-generator artifact.

The mixed profile adds a useful clue. The candidate's top self frames include:

- V8 string hashing and string-table lookup;
- `v8::Object::CreateDataProperty`;
- raw V8 allocation;
- fast data-property insertion and object map migration;
- UTF-8 decoding and string allocation.

This is consistent with the cost of materializing the snapshot as JavaScript
strings, arrays and objects. It is not enough to assign the whole regression to
one native function.

The published `node-v137.node` retains some uWebSockets symbols, but the
`RequestSnapshot` wrapper itself is not named in `perf report`; several addon
frames remain raw addresses. Precise attribution requires rebuilding
`@swarmmachina/swm-uws@0.5.7` with native symbols and then disabling snapshot
fields one at a time.

Raw reports:

- [`profiles/v4.1.1-control/`](profiles/v4.1.1-control/)
- [`profiles/v4.1.1-snapshot/`](profiles/v4.1.1-snapshot/)
