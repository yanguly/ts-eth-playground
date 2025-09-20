FORGE?=forge
RPC?=$(INFURA_SEPOLIA)
PK?=$(PRIVATE_KEY)

.PHONY: test testq testv clean

# Run tests with a clean env so vm.setEnv in tests wins.
test:
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test

# Quick (quiet) run with clean env
testq:
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -q

# Verbose run with traces and clean env
testv:
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -vvv

# Run a single test by name pattern: make one TEST=test_Script_AllPaths
.PHONY: one
one:
	@[ -n "$(TEST)" ] || (echo "Usage: make one TEST=<pattern>" && exit 1)
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -vvv --match-test $(TEST)

# Run the consolidated script test explicitly
.PHONY: testv-all
testv-all:
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -vvv --match-test test_Script_AllPaths

# Deploy UUPS (reads token params from env)
.PHONY: deploy
deploy:
	@[ -n "$(RPC)" ] || (echo "RPC not set. export INFURA_SEPOLIA or pass RPC=<url>" && exit 1)
	@[ -n "$(PK)" ] || (echo "PK not set. export PRIVATE_KEY or pass PK=<hex>" && exit 1)
	$(FORGE) script scripts/DeployUUPS.s.sol:DeployUUPS --rpc-url $(RPC) --private-key $(PK) --broadcast -vv

# Upgrade UUPS (prefers upgradeToAndCall; IMPL_V2 optional via env)
.PHONY: upgrade
upgrade:
	@[ -n "$(RPC)" ] || (echo "RPC not set. export INFURA_SEPOLIA or pass RPC=<url>" && exit 1)
	@[ -n "$(PK)" ] || (echo "PK not set. export PRIVATE_KEY or pass PK=<hex>" && exit 1)
	TOKEN_ADDRESS= IMPL_V2=$$IMPL_V2 MINT_TO= MINT_AMOUNT= $(FORGE) script scripts/UpgradeUUPS.s.sol:UpgradeUUPS --rpc-url $(RPC) --private-key $(PK) --broadcast --skip-simulation -vv

# Validate an upgrade (no on-chain tx)
.PHONY: validate
validate:
	@[ -n "$(RPC)" ] || (echo "RPC not set (export INFURA_SEPOLIA or pass RPC=<url>)" && exit 1)
	@[ -n "$(PK)" ] || (echo "PK not set (export PRIVATE_KEY or pass PK=<hex>)" && exit 1)
	@[ -n "$(TOKEN_ADDRESS)" ] || (echo "TOKEN_ADDRESS not set" && exit 1)
	@[ -n "$(NEW_IMPL_CONTRACT)" ] || (echo "NEW_IMPL_CONTRACT not set (e.g. 'contracts/src/YansTokenUUPSV3.sol:YansTokenUUPSV3')" && exit 1)
	# Hard clean to ensure no stale artifacts linger
	rm -rf out cache
	$(FORGE) clean
	# Normalize artifact paths so they exist under out/src/<File>.sol/<Contract>.json
	mkdir -p out/src/YansTokenUUPSv3.sol
	[ -d out/YansTokenUUPSv3.sol ] && cp -R out/YansTokenUUPSv3.sol/* out/src/YansTokenUUPSv3.sol/ || true
	mkdir -p out/src/YansTokenUUPSv2.sol
	[ -d out/YansTokenUUPSv2.sol ] && cp -R out/YansTokenUUPSv2.sol/* out/src/YansTokenUUPSv2.sol/ || true
	rm -rf out/build-info-pruned
	mkdir -p out/build-info-pruned
	# Prefer a build-info that looks like a full compilation (has input, output, solcVersion) and references v3
	full=$$(for f in out/build-info/*.json; do \
	  if grep -q '"solcVersion"' $$f && grep -q '"input"' $$f && grep -q '"output"' $$f; then \
	    if grep -q 'src/YansTokenUUPSv3\.sol' $$f; then echo $$f; fi; \
	  fi; \
	done | head -1); \
	if [ -z "$$full" ]; then \
	  full=$$(for f in out/build-info/*.json; do \
	    if grep -q '"solcVersion"' $$f && grep -q '"input"' $$f && grep -q '"output"' $$f; then echo $$f; fi; \
	  done | head -1); \
	fi; \
	if [ -n "$$full" ]; then \
	  cp "$$full" out/build-info-pruned/; \
	else \
	  largest=$$(ls -S out/build-info/*.json | head -1); \
	  cp "$$largest" out/build-info-pruned/; \
	fi; \
	rm -rf out/build-info && mv out/build-info-pruned out/build-info
	TOKEN_ADDRESS=$(TOKEN_ADDRESS) NEW_IMPL_CONTRACT=$(NEW_IMPL_CONTRACT) REFERENCE_CONTRACT=$(REFERENCE_CONTRACT) \
	$(FORGE) script scripts/ValidateUpgrade.s.sol:ValidateUpgrade \
		--rpc-url $(RPC) --private-key $(PK) --ffi --skip build -vv

.PHONY: validate-out
validate-out:
	@[ -n "$(RPC)" ] || (echo "RPC not set (export INFURA_SEPOLIA or pass RPC=<url>)" && exit 1)
	@[ -n "$(PK)" ] || (echo "PK not set (export PRIVATE_KEY or pass PK=<hex>)" && exit 1)
	@[ -n "$(TOKEN_ADDRESS)" ] || (echo "TOKEN_ADDRESS not set" && exit 1)
	@[ -n "$(NEW_IMPL_CONTRACT)" ] || (echo "NEW_IMPL_CONTRACT not set (e.g. 'src/YansTokenUUPSv3.sol:YansTokenUUPSV3')" && exit 1)
	# Build into an isolated output directory
	rm -rf out-validate
	$(FORGE) clean
	$(FORGE) build -q --out out-validate
	# Normalize artifact paths under out-validate/src/
	mkdir -p out-validate/src/YansTokenUUPSv3.sol
	[ -d out-validate/YansTokenUUPSv3.sol ] && cp -R out-validate/YansTokenUUPSv3.sol/* out-validate/src/YansTokenUUPSv3.sol/ || true
	mkdir -p out-validate/src/YansTokenUUPSv2.sol
	[ -d out-validate/YansTokenUUPSv2.sol ] && cp -R out-validate/YansTokenUUPSv2.sol/* out-validate/src/YansTokenUUPSv2.sol/ || true
	# Prune build-info to a single full-compilation JSON (prefer one referencing v3)
	rm -rf out-validate/build-info-pruned
	mkdir -p out-validate/build-info-pruned
	full=$$(for f in out-validate/build-info/*.json; do \
	  if grep -q '"solcVersion"' $$f && grep -q '"input"' $$f && grep -q '"output"' $$f; then \
	    if grep -q 'src/YansTokenUUPSv3\.sol' $$f; then echo $$f; fi; \
	  fi; \
	done | head -1); \
	if [ -z "$$full" ]; then \
	  full=$$(for f in out-validate/build-info/*.json; do \
	    if grep -q '"solcVersion"' $$f && grep -q '"input"' $$f && grep -q '"output"' $$f; then echo $$f; fi; \
	  done | head -1); \
	fi; \
	if [ -n "$$full" ]; then \
	  cp "$$full" out-validate/build-info-pruned/; \
	else \
	  largest=$$(ls -S out-validate/build-info/*.json | head -1); \
	  cp "$$largest" out-validate/build-info-pruned/; \
	fi; \
	rm -rf out-validate/build-info && mv out-validate/build-info-pruned out-validate/build-info
	FOUNDRY_OUT=out-validate TOKEN_ADDRESS=$(TOKEN_ADDRESS) NEW_IMPL_CONTRACT=$(NEW_IMPL_CONTRACT) REFERENCE_CONTRACT=$(REFERENCE_CONTRACT) \
	$(FORGE) script scripts/ValidateUpgrade.s.sol:ValidateUpgrade \
		--rpc-url $(RPC) --private-key $(PK) --ffi --skip build -vv

clean:
	$(FORGE) clean
