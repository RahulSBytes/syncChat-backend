# SyncChat - Backend

A robust and scalable Node.js backend for SyncChat, providing RESTful APIs and real-time communication features using Socket.io.

## 🌟 Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Secure password hashing with bcrypt
- Cookie-based session management
- Protected routes and middleware

### 💬 Real-Time Communication
- Socket.io integration for instant messaging
- Real-time typing indicators
- Online/offline status tracking
- Message delivery and read receipts
- Live notifications

### 📁 File Management
- Cloudinary integration for file storage
- Support for multiple file types (images, videos, documents, code files, audio)
- Secure file upload with Multer
- File metadata management

### 👥 User Management
- User registration and authentication
- Profile management with avatars
- Username-based user identification
- User search functionality

### 💬 Chat Features
- One-to-one messaging
- Group chat creation and management
- Add/remove group members
- Transfer group ownership
- Message status tracking (sent, delivered, read)
- Delete messages (for me/for everyone)
- Emoji reactions on messages

### 🎨 Personalization
- User preferences storage
- Theme settings
- Accent color preferences
- Time format preferences (12h/24h)
- Message bubble customization

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **Socket.io** - Real-time bidirectional communication
- **JWT** - JSON Web Tokens for authentication
- **Bcrypt.js** - Password hashing
- **Cloudinary** - Cloud storage for files
- **Multer** - File upload middleware
- **Joi** - Schema validation
- **CORS** - Cross-Origin Resource Sharing
- **Cookie Parser** - Parse cookies
- **UUID** - Generate unique identifiers

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account
- Cloudinary account
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/syncchat-backend.git
   cd syncchat-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Server Configuration
   PORT=8080
   NODE_ENV=development

   # Database
   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/syncchat

   # Authentication
   JWT_SECRET=your_super_secret_jwt_key

   # Frontend URL
   CLIENT_URL=http://localhost:5173

   # Cloudinary (Optional - for file uploads)
   # Add your Cloudinary credentials if using file uploads
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Start production server**
   ```bash
   npm start
   ```

The server will start on `http://localhost:8080`

## 📦 Available Scripts

```bash
npm start       # Start production server
npm run dev     # Start development server with nodemon
```

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── controllers/        # Route controllers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── chat.controller.js
│   │   └── message.controller.js
│   ├── models/            # Mongoose models
│   │   ├── User.js
│   │   ├── Chat.js
│   │   └── Message.js
│   ├── routes/            # API routes
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── chat.routes.js
│   │   └── message.routes.js
│   ├── middleware/        # Custom middleware
│   │   ├── auth.js
│   │   ├── error.js
│   │   └── socketAuthenticator.js
│   ├── utils/             # Utility functions
│   │   ├── db.js
│   │   ├── socket.js
│   │   └── cloudinary.js
│   ├── constants/         # Constants
│   │   └── constants.js
│   └── index.js           # Entry point
├── .env                   # Environment variables
└── package.json           # Dependencies
```

## 🔌 API Endpoints

### Authentication
```
POST   /api/v1/auth/register      # Register new user
POST   /api/v1/auth/login         # User login
POST   /api/v1/auth/logout        # User logout
```

### Users
```
GET    /api/v1/users/getmyprofile # Get current user profile
GET    /api/v1/users/search       # Search users
PUT    /api/v1/users/update       # Update user profile
```

### Chats
```
GET    /api/v1/chats              # Get all chats
POST   /api/v1/chats              # Create new chat/group
GET    /api/v1/chats/:id          # Get specific chat
DELETE /api/v1/chats/:id          # Delete chat
PUT    /api/v1/chats/:id/members  # Add/remove members
PUT    /api/v1/chats/:id/owner    # Transfer ownership
```

### Messages
```
GET    /api/v1/messages/:chatId   # Get messages for a chat
POST   /api/v1/messages           # Send new message
DELETE /api/v1/messages/:id       # Delete message
POST   /api/v1/messages/:id/react # React to message
PUT    /api/v1/messages/:id/read  # Mark message as read
```

### Preferences
```
GET    /api/v1/preferences        # Get user preferences
PUT    /api/v1/preferences        # Update preferences
```

## 🔄 Socket.io Events

### Client → Server
```javascript
'join-chat'           // Join a chat room
'leave-chat'          // Leave a chat room
'send-message'        // Send a new message
'typing-start'        // User started typing
'typing-stop'         // User stopped typing
'message-read'        // Mark message as read
'online'              // User comes online
'offline'             // User goes offline
```

### Server → Client
```javascript
'new-message'         // New message received
'message-deleted'     // Message was deleted
'message-reaction'    // New reaction on message
'user-typing'         // Someone is typing
'user-online'         // User came online
'user-offline'        // User went offline
'message-status'      // Message status updated (delivered/read)
'group-updated'       // Group details changed
```

## 🗄️ Database Schema

### User Model
```javascript
{
  username: String (unique),
  email: String (unique),
  fullName: String,
  password: String (hashed),
  avatar: String (URL),
  bio: String,
  preferences: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Chat Model
```javascript
{
  name: String,
  isGroupChat: Boolean,
  members: [ObjectId],
  admin: ObjectId,
  lastMessage: ObjectId,
  avatar: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Model
```javascript
{
  sender: ObjectId,
  chat: ObjectId,
  content: String,
  attachments: [Object],
  reactions: [Object],
  status: String (sent/delivered/read),
  deletedFor: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

## 🔒 Authentication Flow

1. User registers/logs in
2. Server validates credentials
3. JWT token generated
4. Token stored in httpOnly cookie
5. Client includes cookie in subsequent requests
6. Middleware verifies token
7. Protected routes accessible

### Cookie Configuration
```javascript
{
  httpOnly: true,      // Prevents XSS attacks
  secure: true,        // HTTPS only (production)
  sameSite: 'none',    // Cross-site cookie
  maxAge: 7 days       // Cookie expiration
}
```

## 🌐 CORS Configuration

The backend is configured to accept requests from specified origins:
```javascript
origin: [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://synqchatapp.vercel.app',
  'https://synqchatfrontend.vercel.app'
]
credentials: true
```

## 🚀 Deployment

### Deploy to Render

1. **Push your code to GitHub**

2. **Create a new Web Service on Render**
   - Go to [Render](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

3. **Configure the service**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node

4. **Add environment variables**
   - Add all variables from `.env` file
   - Make sure to set `NODE_ENV=production`

5. **Deploy**
   - Render will automatically build and deploy

### Environment Variables for Production

```env
PORT=8080
NODE_ENV=production
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/syncchat
JWT_SECRET=your_production_jwt_secret
CLIENT_URL=https://your-frontend.vercel.app
```

## 🔧 Error Handling

The application uses a global error handling middleware that:
- Catches all errors
- Formats error responses
- Logs errors for debugging
- Returns appropriate HTTP status codes

## 🛡️ Security Features

- **Password Hashing** - Bcrypt with salt rounds
- **JWT Tokens** - Secure authentication
- **HTTP-only Cookies** - Prevents XSS attacks
- **CORS Configuration** - Controlled access
- **Input Validation** - Joi schema validation
- **Environment Variables** - Sensitive data protection

## 📊 Performance Optimization

- Database indexing on frequently queried fields
- Connection pooling for MongoDB
- Efficient Socket.io room management
- Async/await for non-blocking operations

## 🧪 Testing

```bash
# Add your testing commands here
npm test
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Your Name - [Your GitHub Profile](https://github.com/yourusername)

## 🙏 Acknowledgments

- Built with Node.js and Express
- Real-time features powered by Socket.io
- Cloud storage by Cloudinary
- Database by MongoDB Atlas

---

⭐ If you like this project, please give it a star on GitHub!
