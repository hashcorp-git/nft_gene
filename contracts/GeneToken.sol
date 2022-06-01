pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

contract GeneToken is ERC721Full {

    event GeneUploaded (uint256 indexed tokenId, bytes photo, string title, string description, uint256 timestamp);

    mapping (uint256 => GeneData) private _geneList;

    struct GeneData {
        uint256 tokenId;                       // Unique token id
        address[] ownerHistory;                // History of all previous owners
        bytes photo;                           // Image source encoded in uint 8 array format
        string title;                          // Title of photo
        string description;                    // Short description about the photo
        uint256 timestamp;                     // Uploaded time
    }

    constructor(string memory name, string memory symbol) ERC721Full(name, symbol) public {}

    function mintGENE(
        bytes memory _photo, 
        string memory _title, 
        string memory _description,
        string memory _tokenURI
    )
    public
    {
        // 토큰ID 발급
        uint256 tokenId = totalSupply() + 1;

        // 토큰소유자 주소를 담을 히스토리
        address[] memory ownerHistory;

        GeneData memory newGeneData = GeneData({
            tokenId : tokenId,
            ownerHistory : ownerHistory,
            photo : _photo,
            title: _title,
            description : _description,
            timestamp : now
        });

        _geneList[tokenId] = newGeneData;

        // 토큰소유자의 주소를 히스토리에 추가한다.
        _geneList[tokenId].ownerHistory.push(msg.sender);

        // 토큰발행
        _mint(msg.sender, tokenId);
        // 토큰URI 설정
        _setTokenURI(tokenId, _tokenURI);

        emit GeneUploaded(tokenId, _photo, _title, _description, now);
    }

  /**
   * @notice safeTransferFrom function checks whether receiver is able to handle ERC721 tokens
   *  and then it will call transferFrom function defined below
   */
    function transferOwnership(uint256 tokenId, address to) public returns(uint, address, address, address) {
        safeTransferFrom(msg.sender, to, tokenId);
        uint ownerHistoryLength = _geneList[tokenId].ownerHistory.length;
        return (
            _geneList[tokenId].tokenId,
            //original owner
            _geneList[tokenId].ownerHistory[0],
            //previous owner, length cannot be less than 2
            _geneList[tokenId].ownerHistory[ownerHistoryLength-2],
            //current owner
            _geneList[tokenId].ownerHistory[ownerHistoryLength-1]);
    }

   /**
    * @notice Recommand using transferOwnership, which uses safeTransferFrom function
    * @dev Overided transferFrom function to make sure that every time ownership transfers
    *  new owner address gets pushed into ownerHistory array
    */
    function transferFrom(address from, address to, uint256 tokenId) public {
        super.transferFrom(from, to, tokenId);
        _geneList[tokenId].ownerHistory.push(to);
    }    

    function getGENE (uint256 _tokenId) public view
    returns(uint256, address[] memory, bytes memory, string memory, string memory, uint256) {
        require(_geneList[_tokenId].tokenId != 0, "Photo does not exist");
        return (
            _geneList[_tokenId].tokenId,
            _geneList[_tokenId].ownerHistory,
            _geneList[_tokenId].photo,
            _geneList[_tokenId].title,
            _geneList[_tokenId].description,
            _geneList[_tokenId].timestamp
        );
    }
}
