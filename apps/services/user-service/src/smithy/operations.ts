// Smithy SSDK operation implementations for the user-service pilot.
//
// The generated handlers (from @xcloud/sdk-server) own routing checks,
// deserialization and response/error serialization against the Smithy model —
// these functions supply only the business logic, delegating to the existing
// service layer. Domain errors are rethrown as modeled exceptions so the SSDK
// serializes them with the contract's status codes and shapes.
import {
    GetUser,
    GetUserServerOutput,
    UpdateUser,
    FollowUser,
    UnfollowUser,
    getGetUserHandler,
    getUpdateUserHandler,
    getFollowUserHandler,
    getUnfollowUserHandler,
    UserNotFoundException,
    ConflictException,
    UnauthorizedException,
    ValidationException,
} from "@xcloud/sdk-server";
import type { ValidationCustomizer, ValidationFailure } from "@aws-smithy/server-common";
import * as svc from "../services/user.service";
import { User } from "../models/user.model";
import { HandlerContext, smithyToExpress } from "./express-adapter";

const URL_REGEX = /^https?:\/\/.+/;

// Domain User → modeled output (nulls become omitted members; Date → ISO string).
const toUserOutput = (user: User): GetUserServerOutput => ({
    userId:         user.userId,
    handle:         user.handle,
    displayName:    user.displayName,
    bio:            user.bio ?? undefined,
    avatarUrl:      user.avatarUrl ?? undefined,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    createdAt:      user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
});

// Domain error names → modeled exceptions (status codes come from the model).
const toModeledError = (err: unknown): unknown => {
    const e = err as Error;
    if (e.name === "UserNotFoundError")     return new UserNotFoundException({ message: e.message });
    if (e.name === "AlreadyFollowingError") return new ConflictException({ message: e.message });
    if (e.name === "NotFollowingError")     return new UserNotFoundException({ message: e.message });
    return err; // unexpected → SSDK serializes an InternalFailureException (500)
};

const requireUser = (context: HandlerContext) => {
    if (!context.user) throw new UnauthorizedException({ message: "Unauthorized" });
    return context.user;
};

// With disableDefaultValidation, modeled constraint failures (e.g. missing
// @required members) are mapped through this customizer to our ValidationException.
const validationCustomizer: ValidationCustomizer<string> = (_ctx, failures: ValidationFailure[]) =>
    new ValidationException({
        message: failures.map((f) => `${f.path} failed constraint ${f.constraintType}`).join("; "),
    });

const getUserOperation: GetUser<HandlerContext> = async (input) => {
    try {
        return toUserOutput(await svc.getByHandle(input.handle as string));
    } catch (err) {
        throw toModeledError(err);
    }
};

const updateUserOperation: UpdateUser<HandlerContext> = async (input, context) => {
    const { displayName, bio, avatarUrl } = input;

    if (displayName !== undefined && displayName.length > 50) {
        throw new ValidationException({ message: "displayName must be 50 characters or less" });
    }
    if (bio !== undefined && bio.length > 160) {
        throw new ValidationException({ message: "bio must be 160 characters or less" });
    }
    if (avatarUrl !== undefined && !URL_REGEX.test(avatarUrl)) {
        throw new ValidationException({ message: "avatarUrl must be a valid URL" });
    }
    if (displayName === undefined && bio === undefined && avatarUrl === undefined) {
        throw new ValidationException({ message: "At least one field is required: displayName, bio, avatarUrl" });
    }

    const user = requireUser(context);
    const handle = user.username ?? user["cognito:username"] ?? "";
    try {
        return toUserOutput(await svc.updateProfile(user.sub, handle, { displayName, bio, avatarUrl }));
    } catch (err) {
        throw toModeledError(err);
    }
};

const followUserOperation: FollowUser<HandlerContext> = async (input, context) => {
    const followerId  = requireUser(context).sub;
    const followingId = input.userId as string;

    if (followerId === followingId) {
        throw new ValidationException({ message: "You cannot follow yourself" });
    }
    try {
        await svc.follow(followerId, followingId);
        return {};
    } catch (err) {
        throw toModeledError(err);
    }
};

const unfollowUserOperation: UnfollowUser<HandlerContext> = async (input, context) => {
    const followerId  = requireUser(context).sub;
    const followingId = input.userId as string;
    try {
        await svc.unfollow(followerId, followingId);
        return {};
    } catch (err) {
        throw toModeledError(err);
    }
};

// Express request handlers backed by the generated SSDK handlers.
export const getUser      = smithyToExpress(getGetUserHandler(getUserOperation, validationCustomizer));
export const updateUser   = smithyToExpress(getUpdateUserHandler(updateUserOperation, validationCustomizer));
export const followUser   = smithyToExpress(getFollowUserHandler(followUserOperation, validationCustomizer));
export const unfollowUser = smithyToExpress(getUnfollowUserHandler(unfollowUserOperation, validationCustomizer));
