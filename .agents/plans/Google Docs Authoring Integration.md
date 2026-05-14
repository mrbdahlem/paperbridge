# **Google Docs Integration Spec**

## **Purpose**

Let teachers create assignments in Google Docs, add a PaperBridge QR marker, and either print directly for simple routing or send the document through PaperBridge to generate PDFs with per page and per packet QR codes.

## **Core rule**

Google Docs direct printing does not create per page QR codes.

The header repeats the same QR on every page, so direct printing can only identify the assignment or document copy. Per page codes only exist after PaperBridge processes the exported PDF.

## **QR marker**

PaperBridge inserts a QR code into the Google Docs header.

The QR is a real URL, such as:

```
https://bits.mycode.run/d/abc123
```

The QR appears on every page because it is in the header. The teacher can move it within the header.

The QR also acts as a location marker. When PaperBridge generates a PDF, it finds the placeholder QR on each exported page and covers it with a generated QR code.

## **Metadata**

The QR itself should remain a URL.

Extra metadata can be stored in image alt text when possible:

```
{
 "paperBridge": true,
 "assignmentId": "assign_abc123",
 "markerVersion": 1
}
```

Fallbacks:

Decode or resolve the QR URL.
Look for a nearby visible marker.
Ask the user to relink the Doc manually.

Do not rely on Google exposing “this Doc was copied from that Doc.” Instead, store assignment identity in the marker that gets copied with the document.

## **Copied document detection**

When the add-on opens or validates a Google Doc, compare the current Google document ID with the document ID registered for the marker's `assignmentId`.

If the marker's assignment exists but the current document ID does not match the registered assignment document ID, treat the Doc as a copied or shared derivative. This can happen when the original instructor makes a personal copy, shares a copy with a colleague, or a colleague opens a copied assignment with their own PaperBridge account.

Before changing any assignment linkage, ask the signed-in instructor what to do:

```
This Google Doc contains a PaperBridge marker for an existing assignment, but this Doc is a different copy.

Create a new PaperBridge assignment from this copy?
```

Primary action: create a new assignment on PaperBridge, bind it to the current Google document ID, and replace the copied marker with a marker for the new `assignmentId`.

Secondary action: keep linked to the existing assignment only when the instructor has permission to use that assignment and explicitly chooses to relink this document copy.

Cancel action: leave the marker unchanged and do not register the current document ID.

Never silently attach a new Google document ID to an existing assignment owned by another instructor.

## **Modes**

### **Direct print from teacher master**

QR identifies the assignment only.

Good for: single page work, notes, informal assignments.

Limitations: no page sorting, no packet grouping, no automatic student identity.

### **Direct print from student copy**

If a student receives a copied Google Doc, the copied marker can identify the assignment. The add-on may combine that marker with the current Google Doc ID to register a document copy.

Good for: absent students printing at home.

Limitations: no per page codes. Pages must be submitted in order or reviewed manually.

### **PaperBridge generic PDF**

Teacher sends the Doc through PaperBridge. PaperBridge replaces the repeated placeholder with per page QR codes.

QR identifies:

```
{
 "assignmentId": "assign_abc123",
 "pageNumber": 2
}
```

Good for: page completeness and ordering when packet identity is not needed.

### **PaperBridge anonymous packets**

Teacher requests multiple packet copies. PaperBridge generates unique packet IDs and per page QR codes.

QR identifies:

```
{
 "assignmentId": "assign_abc123",
 "packetId": "7KQ4M",
 "pageNumber": 2
}
```

Good for: real collected assignments, mixed scan stacks, no roster required.

### **Roster packets, later**

Same as anonymous packets, but tied to rostered students and optionally printed with visible student names.

## **Google Docs menu**

```
PaperBridge
 Insert or Refresh QR Marker
 Validate QR Marker
 Build Generic PDF
 Build Anonymous Packets
 Open Assignment Dashboard
```

## **Main workflows**

Teacher direct print:

Create Doc.
Insert QR marker.
Print from Google Docs.
Students write names and submit scans or photos.
System routes by assignment or document copy only.

Teacher packet build:

Create Doc.
Insert QR marker.
Choose Build Anonymous Packets.
PaperBridge exports Doc as PDF.
PaperBridge finds the placeholder QR on each page.
PaperBridge replaces it with packet and page specific QR codes.
Teacher prints the generated packet PDF.

Student copy print:

Student opens copied Doc.
Marker identifies assignment.
Add-on may register current Doc ID as a document copy.
Student prints, completes, then submits pages in order.

Instructor copy or colleague handoff:

Instructor opens a copied Doc whose marker points to an existing assignment.
Add-on detects that the current Google document ID differs from the assignment's registered document ID.
PaperBridge asks whether to create a new assignment from this copy.
If confirmed, PaperBridge creates the new assignment and refreshes the marker.
If canceled, PaperBridge leaves the copied marker untouched.

## **Validation**

PaperBridge should check:

QR marker exists.
QR marker is detectable after PDF export.
Current Google document ID matches the registered assignment document ID, or the instructor has chosen how to handle the copied Doc.
Marker appears on every page.
Marker is large enough to scan.
Generated QR fully covers the placeholder.

## **First prototype test**

Insert QR into Google Docs header.
Move it manually.
Export to PDF.
Detect QR location on each page.
Cover placeholder with generated QR.
Print, scan, and verify QR detection.
