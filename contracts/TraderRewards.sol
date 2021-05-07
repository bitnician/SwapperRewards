pragma solidity =0.6.12;

import './Ownable.sol';
import './interfaces/IERC20.sol';
import './libraries/SafeMath.sol';


/**
 * @title TraderRewards
 * @notice This contract handles the rewards paid to traders ("swappers").
 * Traders receive a set number of TEST tokens per trade as a reward. Rewards are accumulated. Traders can claim rewards by withddrawing them.
 */
contract TraderRewards is Ownable {
    using SafeMath for uint;
    
    //address of our test token
    IERC20 public testToken;
    address public router;
    uint public divisor; // e.g.  50000000 (1e7)
    uint public rewardTokensRemaining; //contains initial and remaining value e.g. 100000000000000000000000000 (1e26)  


    //Keeps track of each trader's balance of TEST reward tokens
    mapping (address => uint) public rewardTokenBalances;



    //Events
    event LogCreated(address indexed createdBy, address indexed testToken, address indexed routerAddress, uint rewardDivisor, uint initialRewardTokens);
    event LogSetRouter(address indexed setBy, address indexed oldAddress, address indexed newAddress);
    event LogSetTestToken(address indexed setBy, address indexed oldAddress, address indexed newAddress);
    event LogSetDivisor(address indexed setBy, uint oldDivisor, uint newDivisor);
    event LogSetRewardTokensRemaining(address indexed setBy, uint oldValue, uint newValue);
    event LogSafeTESTTransfer(address indexed to, uint amount);
    event LogWithdrawal(address indexed withdrawnBy, uint amount);
    event LogRecordTrade(address indexed trader, uint allocatedRewardTokens);
 

    /** 
     * @notice Construct TraderRewards contract
     * @param testTokenAddress Address of the TEST token contract so it can be cast to IERC20 and used by this contract
     * @param routerAddress UniswapV2Router02 address
     * @param rewardDivisor The divisor to use when calculating rewards
     * @param initialRewardTokens The initial number of TEST tokens available to be allocated to traders as rewards
    */
    constructor(address testTokenAddress, address routerAddress, uint rewardDivisor, uint initialRewardTokens) public {
        require(testTokenAddress != address(0), "TraderRewards::constructor: token address is the zero address");
        require(routerAddress != address(0), "TraderRewards::constructor: router address is the zero address");
        require(rewardDivisor > 0, "TraderRewards::constructor: divisor out of range");
        require(initialRewardTokens > 0, "TraderRewards::constructor: initialRewardTokens out of range");
        router = routerAddress;
        testToken = IERC20(testTokenAddress);
        divisor = rewardDivisor;
        rewardTokensRemaining = initialRewardTokens;  
        emit LogCreated(msg.sender, testTokenAddress, routerAddress, rewardDivisor, initialRewardTokens);
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
     * @notice Allows caller to  withdraw all his/her Test reward tokens
    */
    function withdrawRewardTokens() public {
        uint amount = rewardTokenBalances[msg.sender];
        require(amount > 0, "TraderRewards::withdrawRewardTokens: no rewards available for withdrawal");
        rewardTokenBalances[msg.sender] = 0;
        (bool success, uint amountTransferred) = safeTESTTransfer(msg.sender, amount);
        require(success, "TraderRewards::withdrawRewardTokens: transfer unsuccessful");
        emit LogWithdrawal(msg.sender, amountTransferred);
    }

     /**
     * @notice Sets the TEST token contract address. Only callable by the owner
     * @dev Can be used to reset the TEST token address in case it is redployed.
     * @param testTokenAddress TEST token contract address
     */
    function setTestToken(address testTokenAddress) public onlyOwner {
        require(testTokenAddress != address(0), "TraderRewards::setTESTToken: token address is the zero address");
        address currentTestToken = address(testToken);
        testToken = IERC20(testTokenAddress);
        emit LogSetTestToken(msg.sender, currentTestToken, testTokenAddress);
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
     * @notice Safe TEST reward token transfer function.
     * @dev  First checks total supply of TEST tokens available to reward
     * @param to Address to which tokens will be transferred
     * @param amount Number of tokens to be transferred
     * @return success Success indicator
     * @return amountTransferred The actual amount transferred
     */
    function safeTESTTransfer(address to, uint256 amount) internal returns (bool success, uint amountTransferred){
        uint256 testBal = testToken.balanceOf(address(this));
        require(testBal > 0, "TraderRewards:safeTESTTransfer:  no test tokens available to reward");
        if (amount > testBal) {
            amountTransferred = testBal;
            success = testToken.transfer(to, testBal);
            emit LogSafeTESTTransfer(to, testBal);
        } else {
            amountTransferred = amount;
            success = testToken.transfer(to, amount);
            emit LogSafeTESTTransfer(to, amount);
        }
    }


}
