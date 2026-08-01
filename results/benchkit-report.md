# Benchkit benchmark report

- Node.js: v24.17.0
- CPU: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz
- Load generator: @swarmmachina/benchkit@0.2.0
- swm-core: 4.1.1
- swm-uws: 0.5.7
- Connections: 100
- Workers: 4
- Warmup: 30s per process
- Window: 15s
- Candidate rounds: 12

| Case | Δ RPS, median [p25; p75] | Δ CPU/request | Δ p95 | Δ p99 | Errors | Max generator ELU |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| requestSnapshot | -25.55% [-31.06%; -24.92%] | +34.30% [+33.21%; +45.01%] | +35.25% [+34.17%; +44.59%] | +29.99% [+21.31%; +33.31%] | 0 | 22.92% |
| responseBatch | -0.62% [-2.46%; +1.94%] | +0.62% [-2.04%; +2.51%] | 0.00% [-2.52%; +3.27%] | +1.47% [-1.02%; +7.41%] | 0 | 28.38% |
| collectBody | +0.78% [-6.14%; +4.71%] | -0.85% [-4.50%; +6.42%] | -0.52% [-2.94%; +8.17%] | -3.88% [-9.90%; +2.41%] | 0 | 21.32% |
| all-control async GET | -4.89% [-6.04%; -0.59%] | +5.11% [+0.75%; +6.43%] | +5.07% [+1.07%; +7.19%] | +7.71% [+1.16%; +19.18%] | 0 | 18.12% |
| all-control prepared headers | +5.07% [+4.46%; +5.13%] | -4.91% [-5.04%; -4.30%] | -4.87% [-4.91%; -3.90%] | -3.96% [-20.62%; -3.44%] | 0 | 26.85% |
| all-control POST | -1.56% [-3.13%; -0.70%] | +1.59% [+0.69%; +3.20%] | +0.99% [-0.00%; +3.01%] | +4.21% [+1.55%; +5.16%] | 0 | 20.93% |

## Absolute medians

| Case | p95 control → candidate | p99 control → candidate | ELU control → candidate | RSS peak control → candidate |
| --- | ---: | ---: | ---: | ---: |
| requestSnapshot | 7.42 → 10.08 ms | 8.20 → 10.49 ms | 99.56% → 99.55% | 72.14 → 71.29 MiB |
| responseBatch | 6.14 → 6.14 ms | 11.47 → 11.58 ms | 99.53% → 99.54% | 69.49 → 70.04 MiB |
| collectBody | 4.18 → 4.22 ms | 4.83 → 4.84 ms | 99.52% → 99.52% | 72.36 → 68.18 MiB |
| all-control async GET | 7.56 → 7.95 ms | 9.54 → 10.28 ms | 99.56% → 99.52% | 71.70 → 72.73 MiB |
| all-control prepared headers | 6.46 → 6.14 ms | 12.18 → 11.13 ms | 99.53% → 99.56% | 67.75 → 70.00 MiB |
| all-control POST | 4.26 → 4.30 ms | 6.52 → 6.65 ms | 99.52% → 99.49% | 71.85 → 70.77 MiB |
