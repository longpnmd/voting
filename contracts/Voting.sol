// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "hardhat/console.sol";
import "./LVPToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract Voting is Ownable {
    // CONTRUCTERS ===============================================
    uint public startingAt;
    uint public endingAt;
    LVPToken token;
   

    enum Badge { Community, Guild, VC, Judge }
    uint badge_length = 4;
    mapping(address => Player) public Players;
    mapping(string => bool) clusterUidToBoolPlayers;

    mapping(string => Project) public Projects;
    string[] clusterProjects;
    mapping(string => bool) clusterUidToBoolProjects;

    // project_uid => player_uid => total_pledged
    mapping(string => mapping(address =>uint)) clusterVotingsData;
    mapping(Badge => uint) clusterBadgePledge;
    constructor( 
        uint _startingAt, 
        uint _endingAt,
        address _token
        ) 
    {
        startingAt = _startingAt;
        endingAt = _endingAt;
        token = LVPToken(_token);
    }
    struct Project {
        string uid;
        uint allocation;
        uint total_pledged;
        Badge badge;
    }
    struct Player {
        string uid;
        uint total_pledged;
        Badge badge;
    }
    struct StructBadgeResult {
        string winning_project_uid;
        // project_uid => player_uid => total_pledged
        mapping(string => mapping(address =>uint)) votings_data;
    }
    // CONTRUCTERS ===============================================

    // MODIFIERS ===============================================
    modifier validatePlayer(string memory _uid) {
        require(!(bytes(Players[msg.sender].uid).length > 0),"Wallet address is existed");
        
        require(!clusterUidToBoolPlayers[_uid], "Account uid is existed");

        _;
    }
    modifier validateProject(string memory _uid) {
        require(!(bytes(Projects[_uid].uid).length > 0), "Project is existed");
        _;
    }
    modifier validateVoting(string memory _projectUID, uint _badge) {

        require(clusterUidToBoolProjects[_projectUID], "Project not found");

        require(block.timestamp >= startingAt, "It's not time yet to vote");

        require(block.timestamp < endingAt, "Voting time has expired");

        require(_badge > 0, "Specify an amount of token greater than zero");

        uint256 playerBalance = token.balanceOf(msg.sender);

        require(playerBalance >= _badge, "Your balance is lower than the amount of tokens you want to voting");

        _;
    }
    modifier validateWinning() {
        require(block.timestamp >= endingAt, "Voting is not expired");
        _;
    }
    // MODIFIERS ===============================================

    // EVENTS ==================================================
    event REGISTRATION_PLAYER_DONE(string _uid, uint _badge, address _player_address);
    event VOTING_DONE(address _player_address, string _project_uid , uint _amount);
    event TRANSFER_RECEIVED(address _from , uint _amount);
    // EVENTS ==================================================

    // ADMIN ===================================================
    function setAllocationOfProject(string memory _projectUID, uint _allocation)
        public
        onlyOwner
    {
        Projects[_projectUID].allocation = _allocation;
    }
    function registrationProject(string memory _uid, uint _allocation,uint _badge) 
        public 
        validateProject(_uid)
        onlyOwner
    {
        Projects[_uid] = Project({
            uid: _uid,
            allocation: _allocation,
            total_pledged: 0,
            badge: Badge(_badge)
        });
        clusterProjects.push(_uid);
        clusterUidToBoolProjects[_uid] = true;
    }
    function registrationPlayer(string memory _uid, uint _badge)
        public
        validatePlayer(_uid)
    {
        Players[msg.sender] = Player({
            uid: _uid,
            total_pledged: 0,
            badge: Badge(_badge)
        });
        clusterUidToBoolPlayers[_uid] = true;
        emit REGISTRATION_PLAYER_DONE(_uid,_badge,msg.sender);
    }
    function winning(uint _badge)
        public
        view
        validateWinning
        onlyOwner
        returns (string memory project_uid, uint total_pledged)
    {
        (project_uid, total_pledged) = findTop1Voting(_badge);
    }

    
    
    // ADMIN ===================================================

    // PLAYER ==================================================
    
    // receive() payable external {}
    function vote(string memory _uid, uint _pledged)
        public 
        validateVoting(_uid, _pledged)
    {
        (bool sent) = token.transferFrom(msg.sender, address(this), _pledged);
        require(sent, "Failed to transfer tokens from user to voting");
        Player storage sender = Players[msg.sender];
        Project storage project = Projects[_uid];
        sender.total_pledged += _pledged;
        project.total_pledged += _pledged;
        clusterVotingsData[project.uid][msg.sender] += _pledged;
        emit VOTING_DONE(msg.sender , project.uid , _pledged);
    }
    

    // PLAYER ==================================================

    // UTILS ===================================================

    function findTop1Voting(uint _badge) 
        public view 
        returns(string memory _project_uid, uint _total_pledged)
    {
        string memory winning_uid;
        uint max_pledged = 0;
        for (uint index = 0; index < clusterProjects.length; index++) {
            Project storage project = Projects[clusterProjects[index]];
            if (
                project.total_pledged > max_pledged &&
                uint(project.badge) == _badge
            ) {
                winning_uid = project.uid;
                max_pledged = project.total_pledged;
            }
        }
        _project_uid = winning_uid;
        _total_pledged = Projects[winning_uid].total_pledged;
    }

    function fillterPlayersActived(bytes32[] memory _uids)
        public view
        returns(string[] memory)
    {
        string[] memory uids = new string[](_uids.length);
        uint activedLength = 0;
        for (uint256 index = 0; index < _uids.length; index++) {
            string memory str_uid = bytes32ToString(_uids[index]);
            console.log("STRING_BYTE32 %s : %s",str_uid,clusterUidToBoolProjects[str_uid]);
            if(clusterUidToBoolPlayers[str_uid]){
                uids[activedLength] = str_uid;
                activedLength ++;
            }
        }
        return uids;
    }

    function fillterProjectsActived(bytes32[] memory _uids)
        public view
        returns(string[] memory)
    {
        
        string[] memory uids = new string[](_uids.length);
        uint activedLength = 0;
        for (uint256 index = 0; index < _uids.length; index++) {
            string memory str_uid = bytes32ToString(_uids[index]);
            console.log("STRING_BYTE32 %s : %s : %s",str_uid,clusterUidToBoolProjects[str_uid],clusterUidToBoolProjects["5"]);
            if(clusterUidToBoolProjects[str_uid]){
                uids[activedLength] = str_uid;
                activedLength ++;
            }
        }
        return uids;
    }

    function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    // UTILS ===================================================

    // DEVELOPMENT =============================================
    

    // DEVELOPMENT =============================================
}
