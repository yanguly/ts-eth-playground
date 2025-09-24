FORGE?=$(shell command -v forge 2>/dev/null || echo ~/.foundry/bin/forge)
RPC?=$(NETWORK_RPC_URL)
PK?=$(PRIVATE_KEY)
ENV_FILE?=../.env

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
	@[ -n "$(RPC)" ] || (echo "RPC not set. export NETWORK_RPC_URL or pass RPC=<url>" && exit 1)
	@[ -n "$(PK)" ] || (echo "PK not set. export PRIVATE_KEY or pass PK=<hex>" && exit 1)
	$(FORGE) script scripts/DeployUUPS.s.sol:DeployUUPS --rpc-url $(RPC) --private-key $(PK) --broadcast -vv

# Upgrade UUPS (prefers upgradeToAndCall; IMPL_NEW optional via env)
.PHONY: upgrade
upgrade:
	@[ -n "$(RPC)" ] || (echo "RPC not set"; exit 1)
	@[ -n "$(PK)" ]  || (echo "PK not set"; exit 1)
	@[ -n "$(TOKEN_ADDRESS)" ] || (echo "TOKEN_ADDRESS not set"; exit 1)
	@[ -n "$(IMPL_NEW)" ] || (echo "IMPL_NEW not set"; exit 1)
	TOKEN_ADDRESS=$(TOKEN_ADDRESS) IMPL_NEW=$(IMPL_NEW) \
	$(FORGE) script scripts/UpgradeUUPS.s.sol:UpgradeUUPS \
	  --rpc-url $(RPC) --private-key $(PK) --broadcast -vv

# Validate an upgrade (no on-chain tx)
.PHONY: validate
validate:
	@[ -f $(ENV_FILE) ] || (echo "Env file not found: $(ENV_FILE)" && exit 1)
	@set -a; . $(ENV_FILE); set +a; \
	if [ -n "$(NEW_IMPL_CONTRACT)" ]; then export NEW_IMPL_CONTRACT="$(NEW_IMPL_CONTRACT)"; fi; \
	if [ -n "$(REFERENCE_CONTRACT)" ]; then export REFERENCE_CONTRACT="$(REFERENCE_CONTRACT)"; fi; \
	if [ -z "$$NEW_IMPL_CONTRACT" ]; then echo "Missing NEW_IMPL_CONTRACT. Set it in $(ENV_FILE) or pass NEW_IMPL_CONTRACT=<artifact>"; exit 1; fi; \
	if [ -z "$$REFERENCE_CONTRACT" ]; then echo "Missing REFERENCE_CONTRACT. Set it in $(ENV_FILE) or pass REFERENCE_CONTRACT=<artifact>"; exit 1; fi; \
	FOUNDRY_PROFILE=validate $(FORGE) clean && \
	FOUNDRY_PROFILE=validate $(FORGE) build --build-info --skip test && \
	NEW_FQN=$$NEW_IMPL_CONTRACT; \
	REF_FQN=$$REFERENCE_CONTRACT; \
	case $$NEW_FQN in */*) ;; *) NEW_FQN="src/$$NEW_FQN";; esac; \
	case $$REF_FQN in */*) ;; *) REF_FQN="src/$$REF_FQN";; esac; \
	npx @openzeppelin/upgrades-core@1.37.0 validate out/build-info --contract "$$NEW_FQN" --reference "$$REF_FQN" --requireReference

layout:
	@echo "Building with build-info…"
	FOUNDRY_PROFILE=validate $(FORGE) clean
	FOUNDRY_PROFILE=validate $(FORGE) build --build-info --skip test
	@echo "Validating with OpenZeppelin upgrades-core…"
	npx -y @openzeppelin/upgrades-core@1.37.0 validate out/build-info \
	  --contract "$(NEW_IMPL_CONTRACT)" \
	  --reference "$(REFERENCE_CONTRACT)" \
	  --requireReference

clean:
	$(FORGE) clean
