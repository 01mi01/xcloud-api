$version: "2"

namespace com.twitter

use aws.protocols#restJson1

@httpBearerAuth
@title("Twitter Clone API")
@restJson1
service TwitterService {
    version: "2024-01-01"
    operations: [
        GetUser
        UpdateUser
        CreateTweet
        GetTweet
        DeleteTweet
        LikeTweet
        UnlikeTweet
        RetweetTweet
        UnretweetTweet
        FollowUser
        UnfollowUser
        GetFeed
    ]
    errors: [
        UnauthorizedException
        ValidationException
    ]
}

@error("client")
@httpError(401)
structure UnauthorizedException {
    @required
    message: String
}

@error("client")
@httpError(400)
structure ValidationException {
    @required
    message: String
}
