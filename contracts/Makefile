FORGE?=forge

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

# Run a single test by name pattern: make one TEST=test01_
.PHONY: one
one:
	@[ -n "$(TEST)" ] || (echo "Usage: make one TEST=<pattern>" && exit 1)
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -vvv --match-test $(TEST)

# Run each test in isolation to avoid env cross-test leakage
.PHONY: testv-all
testv-all:
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -vvv --match-test test01_
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -vvv --match-test test02_
	TOKEN_ADDRESS= IMPL_V2= $(FORGE) test -vvv --match-test test03_

clean:
	$(FORGE) clean
