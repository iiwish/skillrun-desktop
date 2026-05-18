# T006 Test Results

## RED

Command:

```text
npm test -- src/state/switchboard.test.ts --run
```

Result: failed as expected.

Key output:

```text
Error: Cannot find module './switchboard' imported from 'D:/data/skillrun-desktop/src/state/switchboard.test.ts'
Test Files 1 failed
Tests no tests
```

## GREEN

Command:

```text
npm test -- src/state/switchboard.test.ts --run
```

Result: passed.

Key output:

```text
Test Files 1 passed
Tests 6 passed
```

## Validation

Command:

```text
npm exec tsc -- --noEmit
```

Result: passed.

Command:

```text
npm run build
```

Result: passed.

Key output:

```text
tsc && vite build
29 modules transformed.
built in 1.20s
```

Command:

```text
npm test -- --run
```

Result: passed.

Key output:

```text
Test Files 7 passed
Tests 39 passed
```

Command:

```text
git diff --check
```

Result: initially failed on one trailing whitespace in `.ai-platform/specs/001-desktop-alpha/tasks.md`; fixed before final validation.

Final result: passed.

Command:

```text
python D:\data\ai-rd-skill\ai-delivery-governor\scripts\validate_delivery_artifacts.py --root D:\data\skillrun-desktop --task-id T006
```

Result: passed.

Key output:

```text
ok: delivery artifacts passed lightweight validation
```
