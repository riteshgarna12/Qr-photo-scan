# QR Photo Share: SaaS Platform & App Pitch

A premium, production-ready full-stack SaaS platform allowing event hosts and professional photographers to generate unique QR codes for guests. Guests scan the code to instantly find and download their photos using **AI-Powered Face Recognition** (no guest uploads required).

---

## 1. Executive Summary & Value Proposition

### The Problem
At weddings, graduations, corporate events, and marathons, professional photographers capture thousands of high-quality images. However, delivering these photos to individual guests is a logistical nightmare. Sharing a single gallery link means guests must scroll through thousands of photos to find themselves, which violates privacy and wastes hours of time.

### The Solution: QR Photo Share with AI Face Retrieval
A web-based SaaS platform that streamlines photo delivery:
* **Zero Guest Uploads**: The host or professional photographer uploads all the official event photos to the dashboard.
* **Instant Personalized Access**: Guests scan a venue QR code, snap a quick selfie, and the AI engine instantly retrieves and displays *only* the professional photos they appear in.
* **Friction-Free Downloading**: Guests can download their personalized high-quality memories directly to their phones within seconds.
* **SaaS Monetization**: Event-based pricing tiers based on total uploaded photos and active events, aimed at photographers and event venues.

---

## 2. Customer & User Experience Flow

```mermaid
graph TD
    A[Host/Photographer creates account] --> B[Chooses Subscription Plan]
    B --> C[Creates Event e.g., 'Emery & Cole Wedding']
    C --> D[Photographer uploads all event photos via Dashboard]
    D --> E[AI indexes photo faces and generates embeddings in background]
    C --> F[Host prints/displays Event QR Code at Venue]
    
    subgraph Guest Retrieval Flow (AI Face Search)
        G[Guest scans QR Code] --> H[Opens Event Web App - No Install]
        H --> I[Webcam/Phone Camera captures quick selfie]
        I --> J[AI matches selfie embedding with event photo embeddings]
        J --> K[Personalized Gallery displays photos guest appears in]
        K --> L[Guest downloads their photos instantly]
    end
```

### The Host & Photographer Journey (Dashboard)
1. **Onboard**: Photographer registers, selects a subscription tier, and creates an event.
2. **Bulk Upload**: Uploads all official high-res event photos directly to the event console.
3. **AI Indexing**: The system automatically detects all faces, extracts visual embeddings, and indexes them.
4. **QR Generation**: Downloads the event QR code flyers to place at the registration desk, dining tables, or screen slides.

### The Guest Journey (Friction-Free Retrieval)
1. **Scan**: Guest scans the QR code at the venue.
2. **Selfie Capture**: The mobile browser prompts them to take a quick selfie (no app download or registration required).
3. **Download**: The page instantly displays a curated gallery of all professional photos containing their face for easy saving.

---

## 3. Subscription Tiers & Plan Limits

Monetization is driven by total photo storage capacity and active events, tailored for photographers.

| Feature / Limit | Tier 1: Free (Starter) | Tier 2: Premium (Single Event) | Tier 3: Pro (Professional) |
| :--- | :--- | :--- | :--- |
| **Target Audience** | Testing & small gatherings | One-off wedding hosts, small parties | Professional photographers, venues |
| **Price (Suggested)** | $0 / Free | $39 (Single Event purchase) | $89 / month (Subscription) |
| **Active Events** | 1 Event max | 1 Event max | Unlimited events |
| **Uploaded Photos Limit**| Max 50 photos | Max 1,000 photos | Unlimited |
| **AI Face Matching** | Included | Included | Included + Priority queue speed |
| **Image Resolution** | Standard compressed | High-Res optimized | Original RAW/4K quality |
| **Event Duration** | Expires after 48 hours | Active for 30 days | Always active / customizable |
| **Features Included** | - Basic selfie matching<br>- Web gallery access | - Printable PDF Card creator<br>- Photo Likes<br>- Host Moderation Dashboard<br>- AI-powered Selfie Scan | - Custom domain white-labeling<br>- CSV guest download statistics<br>- Bulk zip downloads<br>- Analytics reports |

---

## 4. Technical Architecture

A robust stack matching your skills profile, optimized for secure photo storage and face search queries.

```
       +-----------------------------------------------+
       |               Client Side UI                  |
       |  React + Tailwind CSS + Framer Motion (Vite)  |
       |  (HTML5 Web Camera Selfie Capture Interface)  |
       +----------------------+------------------------+
                              |
                              | HTTPS REST API (JSON)
                              v
       +----------------------+------------------------+
       |             Backend Server (Node/Express)     |
       |  - JWT Authentication & Event Validation      |
       |  - Bulk Upload Route & Storage Processor      |
       |  - Face Processing Middleware (Gemini/FaceAPI) |
       +-------+--------------------+------------------+
               |                    |
               | (ORM / Queries)    | (Direct Upload)
               v                    v
       +-------+-------+    +-------+------------------+
       |   Database    |    |   Cloud Image Hosting    |
       | MongoDB/SQLite|    |  Cloudinary / AWS S3     |
       +---------------+    +--------------------------+
```

* **Frontend**: React.js SPA using Tailwind CSS v4, Framer Motion, and HTML5 Web Camera API (to capture guest selfies).
* **Backend**: Node.js + Express.js RESTful API, implementing JWT authentication, CORS, rate-limiting, and validation middleware.
* **AI/ML Face Engine**:
  * *Option 1 (Gemini API)*: Use **Google Gemini 2.5 Flash** visual models to analyze similarities.
  * *Option 2 (Node.js native)*: Use **face-api.js** on the Express server to calculate 128-dimensional face embedding vectors upon photo upload.
* **Database**: MongoDB or SQLite storing vectors inside photo sub-documents.
* **Cloud Storage**: Cloudinary or AWS S3 for hosting high-res photos and guest selfies.

---

## 5. Database Schema & Data Models

### User Schema (Hosts / Photographers)
```json
{
  "id": "String (UUID)",
  "email": "String (Unique)",
  "passwordHash": "String",
  "name": "String",
  "subscriptionTier": "String (FREE | PREMIUM | PRO)",
  "subscriptionExpiresAt": "Date",
  "createdAt": "Date"
}
```

### Event Schema
```json
{
  "id": "String (UUID)",
  "hostId": "String (User Reference)",
  "slug": "String (Unique Event Slug, e.g. emery-cole)",
  "eventName": "String",
  "eventDate": "Date",
  "coverImageUrl": "String (Optional)",
  "qrCodeSvg": "String (Store generated vector code)",
  "maxPhotosAllowed": "Number (From Sub Tier)",
  "isLocked": "Boolean",
  "createdAt": "Date"
}
```

### Photo Schema (Admin Uploads only)
```json
{
  "id": "String (UUID)",
  "eventId": "String (Event Reference)",
  "url": "String (Cloud CDN image path)",
  "thumbnailUrl": "String (Cloud CDN optimized preview path)",
  "likes": "Number (Default 0)",
  "featured": "Boolean (Default false)",
  "width": "Number",
  "height": "Number",
  "faces": [
    {
      "box": {
        "x": "Number",
        "y": "Number",
        "width": "Number",
        "height": "Number"
      },
      "descriptor": "Array of Numbers (128-dimensional vector encoding the face)"
    }
  ],
  "uploadedAt": "Date"
}
```

---

## 6. Implementation Roadmap

### Phase 1: Core SaaS Frontend & Routing
* Create the SaaS landing page focusing on photographers (detailing the selfie search features).
* Set up standard routing: Host Login, Host Dashboard (Event creation, bulk upload console), and the guest-facing landing page `e/:slug`.

### Phase 2: Host Bulk Upload & APIs
* Develop Node/Express server boilerplate with CORS and environment configuration.
* Build Authentication routes for hosts.
* Implement bulk file upload handling on the backend using `multer` sending images to Cloudinary/AWS S3.

### Phase 3: DB Integration & AI Face Indexing
* Set up database connection.
* Add face detection to the upload pipeline. As the photographer uploads photos, the server extracts face descriptor vectors and saves them to the DB.

### Phase 4: Guest Selfie Search Flow
* Implement camera stream capture on the guest webpage.
* Build the backend endpoint `/api/events/:eventId/search-face` to compute a selfie's face vector, match it against database vectors (Euclidean distance), and return matching images.
* Display matched photos in a beautiful responsive grid for easy downloading.

### Phase 5: Subscriptions & Limits
* Enforce pricing tier validation during host upload events.
* Polish transitions, loading screens, and custom branded landing styles.
