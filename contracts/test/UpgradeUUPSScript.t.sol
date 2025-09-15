import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {YansTokenUUPS} from "../src/YansTokenUUPS.sol";
import {YansTokenUUPSV2} from "../src/YansTokenUUPSV2.sol";
import {UpgradeUUPS} from "../scripts/UpgradeUUPS.s.sol";

contract UpgradeUUPSScriptTest is Test {
    bytes32 constant SLOT = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;
    bytes32 constant TEST_PK = bytes32(uint256(0xA11CE));
    address signer;

    function setUp() public {
        signer = vm.addr(uint256(TEST_PK));
    }

    function test01_Revert_When_Signer_Not_Owner() public {
        address proxy = _deployProxyOwnedBy(address(0xB0B));
        vm.setEnv("TOKEN_ADDRESS", vm.toString(proxy));
        vm.setEnv("PRIVATE_KEY", vm.toString(TEST_PK));

        UpgradeUUPS script = new UpgradeUUPS();
        vm.expectRevert(bytes("Signer is not owner"));
        script.run();
    }

    function test02_Upgrade_FallbackDeploy_And_Mint() public {
        address proxy = _deployProxyOwnedBy(signer);
        vm.setEnv("TOKEN_ADDRESS", vm.toString(proxy));
        vm.setEnv("PRIVATE_KEY", vm.toString(TEST_PK));
        vm.setEnv("IMPL_V2", "0x"); // invalid -> fallback deploy
        vm.setEnv("MINT_TO", vm.toString(address(0xCAFE)));
        vm.setEnv("MINT_AMOUNT", vm.toString(uint256(123e18)));

        new UpgradeUUPS().run();

        address implAfter = _impl(proxy);
        assertEq(YansTokenUUPSV2(implAfter).proxiableUUID(), SLOT);
        assertEq(YansTokenUUPS(proxy).balanceOf(address(0xCAFE)), 123e18);
    }

    function test03_Upgrade_UsesEnvImpl_And_Mints() public {
        address proxy = _deployProxyOwnedBy(signer);
        address implV2 = address(new YansTokenUUPSV2());
        vm.setEnv("TOKEN_ADDRESS", vm.toString(proxy));
        vm.setEnv("PRIVATE_KEY", vm.toString(TEST_PK));
        vm.setEnv("IMPL_V2", vm.toString(implV2));
        vm.setEnv("MINT_TO", vm.toString(address(0xCAFE)));
        vm.setEnv("MINT_AMOUNT", vm.toString(uint256(123e18)));

        new UpgradeUUPS().run();

        assertEq(_impl(proxy), implV2);
        assertEq(YansTokenUUPS(proxy).balanceOf(address(0xCAFE)), 123e18);
    }

    // helpers
    function _deployProxyOwnedBy(address owner_) private returns (address proxyAddr) {
        YansTokenUUPS implV1 = new YansTokenUUPS();
        bytes memory initData = abi.encodeWithSelector(
            YansTokenUUPS.initialize.selector,
            "YAN",
            "YAN",
            address(0xBEEF),
            1_000 ether
        );
        vm.prank(owner_);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implV1), initData);
        proxyAddr = address(proxy);
    }

    function _impl(address proxyAddr) private view returns (address impl) {
        bytes32 word = vm.load(proxyAddr, SLOT);
        impl = address(uint160(uint256(word)));
    }
}
