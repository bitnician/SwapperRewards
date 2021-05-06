pragma solidity =0.6.12;

import './Ownable.sol';
import './interfaces/IERC20.sol';
import './libraries/SafeMath.sol';


/**
 * @title TraderRewards
 * @notice This contract handles the rewards paid to traders ("swappers").
 * Traders receive a set number of SPH tokens per trade as a reward. Rewards are accumulated. Traders can claim rewards by withddrawing them.
 */
contract TraderRewards is Ownable {
    using SafeMath for uint;
    

    IERC20 public sphToken;
    address public router;
    uint public divisor; // e.g.  50000000 (1e7)
    uint public rewardTokensRemaining; //contains initial and remaining value e.g. 100000000000000000000000000 (1e26)  


    //Keeps track of each trader's balance of SPH reward tokens
    mapping (address => uint) public rewardTokenBalances;



    //Events
    event LogCreated(address indexed createdBy, address indexed sphToken, address indexed routerAddress, uint rewardDivisor, uint initialRewardTokens);
    event LogSetRouter(address indexed setBy, address indexed oldAddress, address indexed newAddress);
    event LogSetSphToken(address indexed setBy, address indexed oldAddress, address indexed newAddress);
    event LogSetDivisor(address indexed setBy, uint oldDivisor, uint newDivisor);
    event LogSetRewardTokensRemaining(address indexed setBy, uint oldValue, uint newValue);
    event LogSafeSPHTransfer(address indexed to, uint amount);
    event LogWithdrawal(address indexed withdrawnBy, uint amount);
    event LogRecordTrade(address indexed trader, uint allocatedRewardTokens);
 

    /** 
     * @notice Construct TraderRewards contract
     * @param sphTokenAddress Address of the SPH token contract so it can be cast to IERC20 and used by this contract
     * @param routerAddress UniswapV2Router02 address
     * @param rewardDivisor The divisor to use when calculating rewards
     * @param initialRewardTokens The initial number of SPH tokens available to be allocated to traders as rewards
    */
    constructor(address sphTokenAddress, address routerAddress, uint rewardDivisor, uint initialRewardTokens) public {
        require(sphTokenAddress != address(0), "TraderRewards::constructor: token address is the zero address");
        require(routerAddress != address(0), "TraderRewards::constructor: router address is the zero address");
        require(rewardDivisor > 0, "TraderRewards::constructor: divisor out of range");
        require(initialRewardTokens > 0, "TraderRewards::constructor: initialRewardTokens out of range");
        router = routerAddress;
        sphToken = IERC20(sphTokenAddress);
        divisor = rewardDivisor;
        rewardTokensRemaining = initialRewardTokens;  
        emit LogCreated(msg.sender, sphTokenAddress, routerAddress, rewardDivisor, initialRewardTokens);
    }

    /**
     * @notice Reverts if function is called by any account other than the router.
     */
    modifier onlyRouter() {
        require(isRouter(), "TraderRewards:onlyRouter: caller is not the router");
        _;
    }

    /**
     * @notice Returns true if the caller is the router contract.
     * @return callerIsRouter Indicates whether or not caller is the router contract
     */
    function isRouter() public view returns (bool callerIsRouter) {
        callerIsRouter = msg.sender == router;
    }

    /** 
     * @notice Calculates rewards for the trade and adds to trader's accumulated rewards
     * @param trader Address of the  trader
    */
    function recordTrade(address trader) public onlyRouter {
        require(trader != address(0), "TraderRewards::recordTrade: trader address is the zero address");
        uint allocatedRewardTokens = rewardTokensRemaining.div(divisor);
        rewardTokenBalances[trader] = rewardTokenBalances[trader].add(allocatedRewardTokens);
        rewardTokensRemaining = rewardTokensRemaining.sub(allocatedRewardTokens);
        emit LogRecordTrade(trader, allocatedRewardTokens); 
    }



    /** 
     * @notice Allows caller to  withdraw all his/her SPH reward tokens
    */
    function withdrawRewardTokens() public {
        uint amount = rewardTokenBalances[msg.sender];
        require(amount > 0, "TraderRewards::withdrawRewardTokens: no rewards available for withdrawal");
        rewardTokenBalances[msg.sender] = 0;
        (bool success, uint amountTransferred) = safeSPHTransfer(msg.sender, amount);
        require(success, "TraderRewards::withdrawRewardTokens: transfer unsuccessful");
        emit LogWithdrawal(msg.sender, amountTransferred);
    }

     /**
     * @notice Sets the SPH token contract address. Only callable by the owner
     * @dev Can be used to reset the SPH token address in case it is redployed.
     * @param sphTokenAddress SPH token contract address
     */
    function setSphToken(address sphTokenAddress) public onlyOwner {
        require(sphTokenAddress != address(0), "TraderRewards::setSphToken: token address is the zero address");
        address currentSphToken = address(sphToken);
        sphToken = IERC20(sphTokenAddress);
        emit LogSetSphToken(msg.sender, currentSphToken, sphTokenAddress);
    }

    /**
     * @notice Sets the router contract address. Only callable by the owner
      * @dev Can be used to reset the router address in case it is redployed.
     * @param routerAddress Router contract address
     */
    function setRouter(address routerAddress) public onlyOwner {
        require(routerAddress != address(0), "TraderRewards::setRouter: router is the zero address");
        address currentRouter = router;
        router  = routerAddress;
        emit LogSetRouter(msg.sender, currentRouter, routerAddress);
    }

    /**
     * @notice Sets the divisor that is used to calculate rewards. Only callable by the owner
     * @param rewardDivisor New divisor
     */
    function setDivisor(uint rewardDivisor) public onlyOwner {
        require(rewardDivisor > 0, "TraderRewards::setDivisor: divisor out of range");
        uint currentDivisor = divisor;
        divisor = rewardDivisor;
        emit LogSetDivisor(msg.sender, currentDivisor, rewardDivisor);
    }

     /**
     * @notice Sets the number of remainign tokens that can be distributed as rewrds. Only callable by the owner
     * @param remainingRewardTokens New divisor
     */
    function setRewardTokensRemaining(uint remainingRewardTokens) public onlyOwner {
        require(rewardTokensRemaining > 0, "TraderRewards::setRewardTokensRemaining: remainingRewardTokens out of range");
        uint currentrewardTokensRemaining = rewardTokensRemaining;
        rewardTokensRemaining = remainingRewardTokens;
        emit LogSetRewardTokensRemaining(msg.sender, currentrewardTokensRemaining, remainingRewardTokens);
    }

    /**
     * @notice Safe SPH reward token transfer function.
     * @dev  First checks total supply of SPH tokens available to reward
     * @param to Address to which tokens will be transferred
     * @param amount Number of tokens to be transferred
     * @return success Success indicator
     * @return amountTransferred The actual amount transferred
     */
    function safeSPHTransfer(address to, uint256 amount) internal returns (bool success, uint amountTransferred){
        uint256 sphBal = sphToken.balanceOf(address(this));
        require(sphBal > 0, "TraderRewards:safeSPHTransfer:  no SPH tokens available to reward");
        if (amount > sphBal) {
            amountTransferred = sphBal;
            success = sphToken.transfer(to, sphBal);
            emit LogSafeSPHTransfer(to, sphBal);
        } else {
            amountTransferred = amount;
            success = sphToken.transfer(to, amount);
            emit LogSafeSPHTransfer(to, amount);
        }
    }


}
