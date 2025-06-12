// const passport = require("passport");
// const GoogleStrategy = require("passport-google-oauth20").Strategy;
// const UserService = require("../user/user.service");
// const Invitation = require("../project/invitation/invitation.model");
// const Project = require("../project/project.model");

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
//       passReqToCallback: true, // Add this to access the request object
//     },
//     async (req, accessToken, refreshToken, profile, done) => {
//       try {
//         const email =
//           profile.emails && profile.emails[0] ? profile.emails[0].value : null;
//         const name =
//           profile.displayName ||
//           `${profile.name.givenName} ${profile.name.familyName}`;
//         const picture = profile._json.picture;
//         const password = "";
//         const inviteToken =
//           req.query.invite ||
//           (req.query.state ? req.query.state.split("=")[1] : null);

//         let user = await UserService.findByEmail(email);

//         if (!user) {
//           user = await UserService.create(name, email, password, picture);

//           // Process invitation if token exists
//           if (inviteToken) {
//             const invitation = await Invitation.findOne({ token: inviteToken });

//             if (invitation && invitation.inviteeEmail === email.toLowerCase()) {
//               const project = await Project.findById(invitation.project);

//               if (!project.members.includes(user._id)) {
//                 project.members.push(user._id);
//                 await project.save();
//               }

//               invitation.status = "Accepted";
//               await invitation.save();
//             }
//           }
//         } else if (inviteToken) {
//           // Handle case where user exists but has an invite
//           const invitation = await Invitation.findOne({
//             token: inviteToken,
//             inviteeEmail: email.toLowerCase(),
//           });

//           if (invitation) {
//             const project = await Project.findById(invitation.project);

//             if (!project.members.includes(user._id)) {
//               project.members.push(user._id);
//               await project.save();
//             }

//             invitation.status = "Accepted";
//             await invitation.save();
//           }
//         }

//         return done(null, user);
//       } catch (error) {
//         console.error("Error during Google OAuth authentication:", error);
//         return done(error, null);
//       }
//     }
//   )
// );

// // Keep existing serialize/deserialize functions

// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await UserService.findById(id);
//     done(null, user);
//   } catch (error) {
//     done(error, null);
//   }
// });
