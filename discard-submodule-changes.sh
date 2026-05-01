#!/usr/bin/env bash
# Discards all uncommitted changes in every Git submodule.

git submodule foreach 'git checkout -- . && git clean -fd'
