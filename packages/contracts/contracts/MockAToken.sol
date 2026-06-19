// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MockAToken
 * @notice ERC-20 + EIP-3009 `transferWithAuthorization`, used by AgentCheckout to
 *         demonstrate a GASLESS x402 "exact" settlement on Monad testnet.
 *
 *         This is a sandbox STAND-IN for a clean A-Token. The real Cleanverse
 *         aUSDC on Monad does NOT implement EIP-3009 (no version()/DOMAIN_SEPARATOR),
 *         so its transfers are plain on-chain ERC-20 moves gated by A-Pass rules.
 *         We deploy this token only so the x402 gasless flow (sign -> facilitator
 *         relays transferWithAuthorization -> real txHash) works end-to-end.
 *
 *         Public `mint` makes it a self-serve testnet faucet. Do not use in prod.
 */
contract MockAToken is ERC20, EIP712 {
    uint8 private immutable _decimals;

    // keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 dec_
    ) ERC20(name_, symbol_) EIP712(name_, "1") {
        _decimals = dec_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
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

    /// @notice Open testnet faucet mint.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice EIP-3009 gasless transfer: a relayer (facilitator) broadcasts a
    ///         transfer the holder authorized off-chain via an EIP-712 signature.
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(block.timestamp > validAfter, "MockAToken: auth not yet valid");
        require(block.timestamp < validBefore, "MockAToken: auth expired");
        require(!_authorizationStates[from][nonce], "MockAToken: nonce already used");

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
        require(signer == from, "MockAToken: invalid signature");

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }
}
