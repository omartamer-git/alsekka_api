# alsekka Backend

This is the backend for the **alsekka** carpooling app, built with Node.js, Express.js, MySQL, and Redis. While the project is no longer actively maintained, it is complete and functional, designed to support all the features of the alsekka app with robust performance and scalability.

---

## Features

### API Functionality
- **Authentication:** User authentication and authorization with secure token-based methods.
- **Ride Management:** Endpoints for creating, updating, searching, and deleting ride offers and requests.
- **User Profiles:** Manage user information, including social media links and community memberships.
- **Real-Time Notifications:** Integration with AWS SNS for sending real-time notifications.
- **Payment Processing:** Integrated w/ Kashier
- **OTP (Missing Functionality):** Integrated w/ sms.com.eg (SMS Misr) & Wasage

### Performance
- **Caching:** Redis is used for caching frequently accessed data to enhance performance.
- **Database:** MySQL provides a relational database for storing user, ride, and community data efficiently.

---

## Tech Stack

- **Framework:** Node.js with Express.js
- **Database:** MySQL
- **Caching:** Redis

---

## Installation and Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```bash
   cd alsekka_api
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Configure environment variables:
   - Create a `.env` file in the root directory with the following values:
     ```env
      KASHIERSECRET=""
      KASHIERAPIKEY=""
      KASHIER_ID=""
      KASHIER_REFUNDURL=""
      REFERRAL_SUM=
      ```
   - Create a `config.js` file in the root directory with the following:
     ```js
      const config = {
        db: {
            host: "127.0.0.1",
            user: "root",
            password: "",
            database: "",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        },
    
        app: {
            port: 3000
        },
    
        otp: {
            environment: "2",
            username: '',
            password: '',
            sender: '',
            template: '',
            expiryMinutes: 10
        }
      };
      
      module.exports = config;

      ```

5. Start the server:
   ```bash
   npm start
   ```

---

## API Documentation

Unfortunately, no documentation for the API is available. Feel free to reach out if you need help with understanding anything.

---

## Contributing

Contributions are welcome to enhance or extend the backend functionality. Ensure code quality and consistency by adhering to the existing style guide.

---

## Need Help?

If you are considering using this backend for your project and need guidance, feel free to reach out. I’d be happy to assist with any questions or challenges.

---

## License

This project is provided as-is under an open-source license.
