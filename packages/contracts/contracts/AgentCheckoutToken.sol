// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AgentCheckoutToken (acUSD)
 * @notice ERC-20 + full EIP-3009 (`transferWithAuthorization`, `authorizationState`,
 *         `DOMAIN_SEPARATOR`, `version`) so the x402 "exact" gasless flow works
 *         end-to-end on 0G Galileo. Public `mint` makes it a self-serve faucet
 *         for the demo. NOT production-grade.
 *
 *         On Monad the AgentCheckout demo had to fall back to a "direct" signed
 *         transfer because Cleanverse aUSDC has no EIP-3009 (version()/
 *         DOMAIN_SEPARATOR revert). On 0G we deploy our own token and restore
 *         the clean gasless flow — that's the EIP-3009 win we sell to judges.
 */
contract AgentCheckoutToken is ERC20, EIP712 {
    uint8 private constant _DECIMALS = 6;

    // keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor()
        ERC20("AgentCheckout USD", "acUSD")
        EIP712("AgentCheckout USD", "1")
    {
        _mint(msg.sender, 1_000_000 * 10 ** uint256(_DECIMALS));
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function version() external pure returns (string memory) {
        return "1";
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    /// @notice Open testnet faucet mint. Demo only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice EIP-3009 gasless transfer. The holder signs off-chain, any relayer
    ///         (the AgentCheckout facilitator) broadcasts.
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(block.timestamp > validAfter, "acUSD: auth not yet valid");
        require(block.timestamp < validBefore, "acUSD: auth expired");
        require(!_authorizationStates[from][nonce], "acUSD: nonce already used");

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == from, "acUSD: invalid signature");

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }
}
