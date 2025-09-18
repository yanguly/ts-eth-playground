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
	@[ -n "$(IMPL_NEW)" ] || (echo "IMPL_NEW not set" && exit 1)
	TOKEN_ADDRESS=$(TOKEN_ADDRESS) IMPL_NEW=$(IMPL_NEW) \
	$(FORGE) script scripts/ValidateUpgrade.s.sol:ValidateUpgrade \
		--rpc-url $(RPC) --private-key $(PK) -vv

clean:
	$(FORGE) clean
