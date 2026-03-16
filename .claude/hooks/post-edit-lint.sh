#!/bin/bash
# Runs after every Edit/Write — auto-fix then verify 0 errors
PROJECT="/Users/svetlana/Desktop/Product/VSCode/projects/mycolortype(last ver)/mycolortype"

cd "$PROJECT"

npm run lint:fix --silent 2>&1
npm run lint --silent 2>&1 | tail -3
