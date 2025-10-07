import Principal "mo:base/Principal";
import Time "mo:base/Time";
import HashMap "mo:base/HashMap";
import Array "mo:base/Array";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Result "mo:base/Result";
import Debug "mo:base/Debug";
import Buffer "mo:base/Buffer";
import Int "mo:base/Int";
import Char "mo:base/Char";
import Iter "mo:base/Iter";

/// User management canister for profiles, sessions, and social features
actor BikeraUser {
  // ===== TYPES =====
  public type UserId = Principal;
  public type Timestamp = Time.Time;//Int
  public type Distance = Nat; // in meters
  public type Speed = Nat; // in km/h
  public type TokenAmount = Nat;

  //1 token 1000000000

  public type UserProfile = {
    id : UserId;
    username : Text;
    email : ?Text;
    displayName : ?Text;
    bio : ?Text;
    avatar : ?Text;
    totalDistance : Distance;
    totalXP : Nat;
    totalIMERA : TokenAmount;
    isActive : Bool;
    isVerified : Bool;
    lastActivity : Timestamp;
    createdAt : Timestamp;
    updatedAt : Timestamp;
    preferences : UserPreferences;
    socialLinks : SocialLinks;
    achievements : [Text];
    referralCode : Text;
    referredBy : ?UserId;
    privacySettings : PrivacySettings;
  };

  public type UserPreferences = {
    theme : Text; // "light" | "dark" | "auto"
    language : Text; // "en" | "es" | "fr" | etc.
    units : Text; // "metric" | "imperial"
    notifications : NotificationSettings;
    autoStart : Bool;
    voiceGuidance : Bool;
    dataSharing : Bool;
  };

  public type NotificationSettings = {
    email : Bool;
    push : Bool;
    achievements : Bool;
    rewards : Bool;
    social : Bool;
    marketing : Bool;
  };

  public type SocialLinks = {
    twitter : ?Text;
    instagram : ?Text;
    strava : ?Text;
    website : ?Text;
  };

  public type PrivacySettings = {
    profileVisibility : Text; // "public" | "friends" | "private"
    showDistance : Bool;
    showSpeed : Bool;
    showLocation : Bool;
    allowFriendRequests : Bool;
    showAchievements : Bool;
  };

  public type ActivitySession = {
    id : Text;
    userId : UserId;
    startTime : Timestamp;
    endTime : ?Timestamp;
    distance : Distance;
    maxSpeed : Speed;
    avgSpeed : Speed;
    duration : Nat; // in seconds
    isActive : Bool;
    route : [LocationPoint];
  };

  public type LocationPoint = {
    latitude : Float;
    longitude : Float;
    timestamp : Timestamp;
    accuracy : ?Float;
  };

  public type FriendRequest = {
    id : Text;
    from : UserId;
    to : UserId;
    status : Text; // "pending" | "accepted" | "rejected"
    createdAt : Timestamp;
    respondedAt : ?Timestamp;
  };

  public type UserStats = {
    totalSessions : Nat;
    totalDistance : Distance;
    totalTime : Nat; // in seconds
    avgSpeed : Speed;
    maxSpeed : Speed;
    longestSession : Nat; // in seconds
    currentStreak : Nat; // days
    longestStreak : Nat; // days
    achievements : Nat;
    friends : Nat;
  };

  // ===== STATE =====
  // User data storage
  private var userProfiles = HashMap.HashMap<UserId, UserProfile>(0, Principal.equal, Principal.hash);
  private var userSessions = HashMap.HashMap<UserId, [ActivitySession]>(0, Principal.equal, Principal.hash);
  private var friendRequests = HashMap.HashMap<Text, FriendRequest>(0, Text.equal, Text.hash);
  private var userFriends = HashMap.HashMap<UserId, [UserId]>(0, Principal.equal, Principal.hash);
  private var referralCodes = HashMap.HashMap<Text, UserId>(0, Text.equal, Text.hash);
  private var userStats = HashMap.HashMap<UserId, UserStats>(0, Principal.equal, Principal.hash);
  
  // Security: Admin principal
  private let ADMIN_PRINCIPAL: Principal = Principal.fromText("xsvih-nzaqn-q3edk-ijqkq-3qymg-qxf4z-pqou7-g5t2r-36ukb-ioiqc-7qe"); // TODO: Replace with actual admin principal

  // ===== SECURITY FUNCTIONS =====
  /// Check if caller is admin
  private func isAdmin(caller: Principal): Bool {
    caller == ADMIN_PRINCIPAL
  };

  // ===== HELPER FUNCTIONS =====

  // Take the first `n` Unicode characters from `text`.
  // private func getFirstNChars(text : Text, n : Nat) : Text {
  //   if (n == 0) { return "" };

  //   var result = "";
  //   var count = 0;
  //   for (c in text.chars()) {
  //     if (count >= n) { break };
  //     result := result # Char.toText(c);
  //     count += 1;
  //   };
  //   return result;
  // };

  // // Generate a referral code like: BIKERA1234abcd
  private func generateReferralCode(userId : UserId) : Text {
    let principalText = Principal.toText(userId);
    let timestamp = Time.now();
    let randomSuffix = Int.abs(timestamp % 10000);
    return "";
    // "BIKERA" # Nat.toText(randomSuffix) # getFirstNChars(principalText, 4);
  };

  private func generateSessionId() : Text {
    let timestamp = Time.now();
    let random = Int.abs(timestamp % 1000000);
    "session_" # Nat.toText(Int.abs(timestamp)) # "_" # Nat.toText(random);
  };

  private func getUserProfileInternal(userId : UserId) : ?UserProfile {
    userProfiles.get(userId);
  };

  private func updateUserProfile(userId : UserId, profile : UserProfile) : () {
    userProfiles.put(userId, profile);
  };

  private func getUserStatsInternal(userId : UserId) : UserStats {
    switch (userStats.get(userId)) {
      case null {
        {
          totalSessions = 0;
          totalDistance = 0;
          totalTime = 0;
          avgSpeed = 0;
          maxSpeed = 0;
          longestSession = 0;
          currentStreak = 0;
          longestStreak = 0;
          achievements = 0;
          friends = 0;
        };
      };
      case (?stats) { stats };
    };
  };

  private func updateUserStats(userId : UserId, stats : UserStats) : () {
    userStats.put(userId, stats);
  };

  private func findSessionIndex(sessions : [ActivitySession], sessionId : Text) : ?Nat {
    var index = 0;
    for (session in sessions.vals()) {
      if (session.id == sessionId and session.isActive) {
        return ?index;
      };
      index += 1;
    };
    null;
  };

  // ===== USER REGISTRATION & MANAGEMENT =====
  /// Register a new user with profile information
  public func registerUser(
    username : Text,
    email : ?Text,
    displayName : ?Text,
    referredByCode : ?Text,
    caller : UserId,
  ) : async Result.Result<UserProfile, Text> {

    // Check if user already exists
    switch (getUserProfileInternal(caller)) {
      case (?_) { return #err("User already registered") };
      case null { /* Continue with registration */ };
    };

    // Validate username
    if (Text.size(username) < 3 or Text.size(username) > 20) {
      return #err("Username must be between 3 and 20 characters");
    };

    // Check if username is already taken
    let existingUsers = Iter.toArray(userProfiles.entries());
    let existingUser = Array.find<(UserId, UserProfile)>(
      existingUsers,
      func((_, profile)) = profile.username == username,
    );
    if (existingUser != null) {
      return #err("Username already taken");
    };

    let now = Time.now();
    let referralCode = generateReferralCode(caller);

    // Handle referral
    let referredBy = switch (referredByCode) {
      case null { null };
      case (?code) {
        switch (referralCodes.get(code)) {
          case null { null };
          case (?referrerId) { ?referrerId };
        };
      };
    };

    let profile : UserProfile = {
      id = caller;
      username = username;
      email = email;
      displayName = displayName;
      bio = null;
      avatar = null;
      totalDistance = 0;
      totalXP = 0;
      totalIMERA = 0;
      isActive = true;
      isVerified = false;
      lastActivity = now;
      createdAt = now;
      updatedAt = now;
      preferences = {
        theme = "auto";
        language = "en";
        units = "metric";
        notifications = {
          email = true;
          push = true;
          achievements = true;
          rewards = true;
          social = false;
          marketing = false;
        };
        autoStart = false;
        voiceGuidance = false;
        dataSharing = true;
      };
      socialLinks = {
        twitter = null;
        instagram = null;
        strava = null;
        website = null;
      };
      achievements = [];
      referralCode = referralCode;
      referredBy = referredBy;
      privacySettings = {
        profileVisibility = "public";
        showDistance = true;
        showSpeed = true;
        showLocation = false;
        allowFriendRequests = true;
        showAchievements = true;
      };
    };

    updateUserProfile(caller, profile);
    referralCodes.put(referralCode, caller);

    #ok(profile);
  };

  public func updateProfile(
    username : ?Text,
    email : ?Text,
    displayName : ?Text,
    bio : ?Text,
    avatar : ?Text,
    socialLinks : ?SocialLinks,
    caller : UserId,
  ) : async Result.Result<Text, Text> {

    switch (getUserProfileInternal(caller)) {
      case null { return #err("User not found") };
      case (?profile) {
        // Validate username if provided
        switch (username) {
          case null { /* No change */ };
          case (?newUsername) {
            if (Text.size(newUsername) < 3 or Text.size(newUsername) > 20) {
              return #err("Username must be between 3 and 20 characters");
            };

            // Check if username is already taken by another user
            let existingUsers = Iter.toArray(userProfiles.entries());
            let existingUser = Array.find<(UserId, UserProfile)>(
              existingUsers,
              func((id, p)) = p.username == newUsername and id != caller,
            );
            if (existingUser != null) {
              return #err("Username already taken");
            };
          };
        };

        let updatedProfile = {
          profile with
          username = switch (username) {
            case null { profile.username };
            case (?u) { u };
          };
          email = switch (email) {
            case null { profile.email };
            case (?e) { ?e };
          };
          displayName = switch (displayName) {
            case null { profile.displayName };
            case (?d) { ?d };
          };
          bio = switch (bio) { case null { profile.bio }; case (?b) { ?b } };
          avatar = switch (avatar) {
            case null { profile.avatar };
            case (?a) { ?a };
          };
          socialLinks = switch (socialLinks) {
            case null { profile.socialLinks };
            case (?s) { s };
          };
          updatedAt = Time.now();
        };

        updateUserProfile(caller, updatedProfile);
        #ok("Profile updated successfully");
      };
    };
  };

  public func updatePreferences(preferences : UserPreferences, caller : UserId) : async Result.Result<Text, Text> {

    switch (getUserProfileInternal(caller)) {
      case null { return #err("User not found") };
      case (?profile) {
        let updatedProfile = {
          profile with
          preferences = preferences;
          updatedAt = Time.now();
        };
        updateUserProfile(caller, updatedProfile);
        #ok("Preferences updated successfully");
      };
    };
  };

  public func updatePrivacySettings(privacySettings : PrivacySettings, caller : UserId) : async Result.Result<Text, Text> {

    switch (getUserProfileInternal(caller)) {
      case null { return #err("User not found") };
      case (?profile) {
        let updatedProfile = {
          profile with
          privacySettings = privacySettings;
          updatedAt = Time.now();
        };
        updateUserProfile(caller, updatedProfile);
        #ok("Privacy settings updated successfully");
      };
    };
  };

  // ===== ACTIVITY SESSIONS =====
  /// Start a new activity tracking session
  public func startActivitySession(caller : UserId) : async Result.Result<Text, Text> {

    switch (getUserProfileInternal(caller)) {
      case null { return #err("User not found") };
      case (?profile) {
        let sessionId = generateSessionId();
        let now = Time.now();

        let session : ActivitySession = {
          id = sessionId;
          userId = caller;
          startTime = now;
          endTime = null;
          distance = 0;
          maxSpeed = 0;
          avgSpeed = 0;
          duration = 0;
          isActive = true;
          route = [];
        };

        let currentSessions = switch (userSessions.get(caller)) {
          case null { [] };
          case (?sessions) { sessions };
        };

        userSessions.put(caller, Array.append(currentSessions, [session]));

        // Update user activity
        let updatedProfile = {
          profile with
          lastActivity = now;
          isActive = true;
        };
        updateUserProfile(caller, updatedProfile);

        #ok(sessionId);
      };
    };
  };

  public func updateActivitySession(
    sessionId : Text,
    distance : Distance,
    maxSpeed : Speed,
    avgSpeed : Speed,
    routePoint : ?LocationPoint,
    caller : UserId,
  ) : async Result.Result<Text, Text> {

    switch (userSessions.get(caller)) {
      case null { return #err("No sessions found") };
      case (?sessions) {
        let sessionIndex = findSessionIndex(sessions, sessionId);

        switch (sessionIndex) {
          case null { return #err("Session not found or not active") };
          case (?index) {
            let session = sessions[index];
            let now = Time.now();
            let duration = now - session.startTime;

            let updatedRoute = switch (routePoint) {
              case null { session.route };
              case (?point) { Array.append(session.route, [point]) };
            };

            let updatedSession = {
              session with
              distance = distance;
              maxSpeed = maxSpeed;
              avgSpeed = avgSpeed;
              duration = Int.abs(duration);
              route = updatedRoute;
            };

            let newSessions = Array.tabulate<ActivitySession>(
              Array.size(sessions),
              func(i) = if (i == index) { updatedSession } else { sessions[i] },
            );

            userSessions.put(caller, newSessions);
            #ok("Session updated successfully");
          };
        };
      };
    };
  };

  public func endActivitySession(sessionId: Text, caller: UserId): async Result.Result<Text, Text> {

      switch (userSessions.get(caller)) {
          case null { return #err("No sessions found") };
          case (?sessions) {
              let sessionIndex = findSessionIndex(sessions, sessionId);

              switch (sessionIndex) {
                  case null { return #err("Session not found or not active") };
                  case (?index) {
                      let session = sessions[index];
                      let now = Time.now();
                      let duration = Int.abs(now - session.startTime);

                      let updatedSession = {
                          session with
                          endTime = ?now;
                          duration = duration;
                          isActive = false;
                      };

                      let newSessions = Array.tabulate<ActivitySession>(
                          Array.size(sessions),
                          func(i) = if (i == index) { updatedSession } else { sessions[i] }
                      );

                      userSessions.put(caller, newSessions);

                      // Update user stats
                      let stats = getUserStatsInternal(caller);
                      let updatedStats = {
                          stats with
                          totalSessions = stats.totalSessions + 1;
                          totalDistance = stats.totalDistance + session.distance;
                          totalTime = stats.totalTime + duration;
                          avgSpeed = if (stats.totalSessions > 0) {
                              (stats.avgSpeed + session.avgSpeed) / 2
                          } else {
                              session.avgSpeed
                          };
                          maxSpeed = if (session.maxSpeed > stats.maxSpeed) {
                              session.maxSpeed
                          } else {
                              stats.maxSpeed
                          };
                          longestSession = if (duration > stats.longestSession) {
                              duration
                          } else {
                              stats.longestSession
                          };
                      };
                      updateUserStats(caller, updatedStats);

                      #ok("Session ended successfully")
                  };
              };
          };
      }
  };

  // ===== SOCIAL FEATURES =====
  /// Send friend request to another user
  public func sendFriendRequest(toUserId : UserId, caller : UserId) : async Result.Result<Text, Text> {

    if (caller == toUserId) {
      return #err("Cannot send friend request to yourself");
    };

    // Check if users exist
    switch (getUserProfileInternal(caller), getUserProfileInternal(toUserId)) {
      case (null, _) { return #err("Your profile not found") };
      case (_, null) { return #err("Target user not found") };
      case (?_, ?_) {
        // Check if request already exists
        let requestId = Principal.toText(caller) # "_" # Principal.toText(toUserId);
        switch (friendRequests.get(requestId)) {
          case (?_) { return #err("Friend request already sent") };
          case null {
            let now = Time.now();
            let request : FriendRequest = {
              id = requestId;
              from = caller;
              to = toUserId;
              status = "pending";
              createdAt = now;
              respondedAt = null;
            };

            friendRequests.put(requestId, request);
            #ok("Friend request sent successfully");
          };
        };
      };
    };
  };

  public func respondToFriendRequest(requestId : Text, accept : Bool, caller : UserId) : async Result.Result<Text, Text> {

    switch (friendRequests.get(requestId)) {
      case null { return #err("Friend request not found") };
      case (?request) {
        if (request.to != caller) {
          return #err("Not authorized to respond to this request");
        };

        if (request.status != "pending") {
          return #err("Request already responded to");
        };

        let now = Time.now();
        let newStatus = if (accept) { "accepted" } else { "rejected" };

        let updatedRequest = {
          request with
          status = newStatus;
          respondedAt = ?now;
        };

        friendRequests.put(requestId, updatedRequest);

        // If accepted, add to friends lists
        if (accept) {
          let fromFriends = switch (userFriends.get(request.from)) {
            case null { [] };
            case (?friends) { friends };
          };
          let toFriends = switch (userFriends.get(request.to)) {
            case null { [] };
            case (?friends) { friends };
          };

          userFriends.put(request.from, Array.append(fromFriends, [request.to]));
          userFriends.put(request.to, Array.append(toFriends, [request.from]));
        };

        #ok("Friend request " # (if (accept) { "accepted" } else { "rejected" }));
      };
    };
  };

  // ===== QUERIES =====
  public query func getUserProfile(userId : UserId) : async ?UserProfile {
    getUserProfileInternal(userId);
  };

  public query func getCurrentUserProfile(caller : UserId) : async ?UserProfile {
    getUserProfileInternal(caller);
  };

  public query func getUserStats(userId : UserId) : async UserStats {
    getUserStatsInternal(userId);
  };

  public query func getActivitySessions(userId : UserId, limit : ?Nat) : async [ActivitySession] {
    switch (userSessions.get(userId)) {
      case null { [] };
      case (?sessions) {
        switch (limit) {
          case null { sessions };
          case (?l) {
            let size = Array.size(sessions);
            if (size <= l) {
              sessions;
            } else {
              Array.subArray(sessions, size - l, l);
            };
          };
        };
      };
    };
  };

  public query func getFriends(userId : UserId) : async [UserId] {
    switch (userFriends.get(userId)) {
      case null { [] };
      case (?friends) { friends };
    };
  };

  public query func getFriendRequests(userId: UserId): async [FriendRequest] {
      let allRequests = Buffer.Buffer<(Text, FriendRequest)>(0);
      for ((requestId, request) in friendRequests.entries()) {
          allRequests.add((requestId, request));
      };
      let allRequestsArray = Buffer.toArray(allRequests);

      let filteredRequests = Array.filter<(Text, FriendRequest)>(
          allRequestsArray,
          func((_, request)) = request.to == userId and request.status == "pending"
      );
      Array.map<(Text, FriendRequest), FriendRequest>(
          filteredRequests,
          func((_, request)) = request
      )
  };

  // public query func searchUsers(query: Text, limit: Nat): async [UserProfile] {
  //     let allProfiles = Buffer.Buffer<(UserId, UserProfile)>(0);
  //     for ((userId, profile) in userProfiles.entries()) {
  //         allProfiles.add((userId, profile));
  //     };
  //     let allProfilesArray = Buffer.toArray(allProfiles);

  //     let matchingProfiles = Array.filter<(UserId, UserProfile)>(
  //         allProfilesArray,
  //         func((_, profile)) =
  //             Text.contains(profile.username, #text(query)) or
  //             switch (profile.displayName) {
  //                 case null { false };
  //                 case (?name) { Text.contains(name, #text(query)) };
  //             }
  //     );

  //     let results = Array.map<(UserId, UserProfile), UserProfile>(
  //         matchingProfiles,
  //         func((_, profile)) = profile
  //     );

  //     let resultSize = Array.size(results);
  //     let takeCount = if (resultSize <= limit) { resultSize } else { limit };
  //     Array.tabulate<UserProfile>(
  //         takeCount,
  //         func(i) = results[i]
  //     )
  // };

  public query func getLeaderboard(limit : Nat) : async [(UserId, Distance)] {
    let allProfiles = Buffer.Buffer<(UserId, UserProfile)>(0);
    for ((userId, profile) in userProfiles.entries()) {
      allProfiles.add((userId, profile));
    };
    let allProfilesArray = Buffer.toArray(allProfiles);

    let sortedProfiles = Array.sort<(UserId, UserProfile)>(
      allProfilesArray,
      func((_, a), (_, b)) = if (a.totalDistance > b.totalDistance) { #greater } else {
        #less;
      },
    );

    let leaderboard = Array.map<(UserId, UserProfile), (UserId, Distance)>(
      sortedProfiles,
      func((userId, profile)) = (userId, profile.totalDistance),
    );

    Array.take<(UserId, Distance)>(leaderboard, limit);
  };

  // ===== ADMIN FUNCTIONS =====
  /// Verify user account (admin only)
  public shared(msg) func verifyUser(userId : UserId) : async Result.Result<Text, Text> {
    let caller = msg.caller;
    
    // Security check: Only admin can verify users
    if (not isAdmin(caller)) {
      return #err("Unauthorized: Admin access required");
    };
    
    switch (getUserProfileInternal(userId)) {
      case null { return #err("User not found") };
      case (?profile) {
        let updatedProfile = {
          profile with
          isVerified = true;
          updatedAt = Time.now();
        };
        updateUserProfile(userId, updatedProfile);
        #ok("User verified successfully");
      };
    };
  };

  /// Deactivate user (admin only)
  public shared(msg) func deactivateUser(userId : UserId) : async Result.Result<Text, Text> {
    let caller = msg.caller;
    
    // Security check: Only admin can deactivate users
    if (not isAdmin(caller)) {
      return #err("Unauthorized: Admin access required");
    };
    
    switch (getUserProfileInternal(userId)) {
      case null { return #err("User not found") };
      case (?profile) {
        let updatedProfile = {
          profile with
          isActive = false;
          updatedAt = Time.now();
        };
        updateUserProfile(userId, updatedProfile);
        #ok("User deactivated successfully");
      };
    };
  };

  /// Clear user data (admin only)
  public shared(msg) func clearUserData(userId : UserId) : async Result.Result<Text, Text> {
    let caller = msg.caller;
    
    // Security check: Only admin can clear user data
    if (not isAdmin(caller)) {
      return #err("Unauthorized: Admin access required");
    };
    
    userProfiles.delete(userId);
    userSessions.delete(userId);
    userStats.delete(userId);
    userFriends.delete(userId);
    #ok("User data cleared successfully");
  };
};
