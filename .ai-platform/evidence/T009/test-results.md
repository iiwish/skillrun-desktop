# T009 Test Results

## RED

Command:

```text
npm test -- src/state/runs.test.ts --run
```

Result: failed as expected.

Key output:

```text
Error: Cannot find module './runs' imported from 'D:/data/skillrun-desktop/src/state/runs.test.ts'
Test Files 1 failed
Tests no tests
```

## GREEN

Command:

```text
npm test -- src/state/runs.test.ts --run
```

Result: passed.

Key output:

```text
Test Files 1 passed
Tests 4 passed
```

## Validation

Command:

```text
npm exec tsc -- --noEmit
```

Initial result: failed due unused test import, JSON fixture literal type widening, and an error helper return type that was too broad.

Resolution: fixed inside T009-owned files only. No production contract or parser was changed.

Final result: passed.

Command:

```text
npm run build
```

Result: passed.

Key output:

```text
tsc && vite build
29 modules transformed.
built in 1.12s
```

Command:

```text
npm test -- --run
```

Result: passed.

Key output:

```text
Test Files 10 passed
Tests 55 passed
```

Command:

```text
git diff --check
```

Result: passed.

Command:

```text
python D:\data\ai-rd-skill\ai-delivery-governor\scripts\validate_delivery_artifacts.py --root D:\data\skillrun-desktop --task-id T009
```

Result: passed.

Key output:

```text
ok: delivery artifacts passed lightweight validation
```
