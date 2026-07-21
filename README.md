# AIS Lab Homepage

A responsive one-page laboratory website built with plain HTML, CSS, and JavaScript.
No build command or package installation is required.

## 1. Open in VS Code

1. Extract the ZIP file.
2. Open the `ais-lab-homepage` folder in VS Code.
3. Install the VS Code extension **Live Server**.
4. Right-click `index.html` and choose **Open with Live Server**.

## 2. Files to edit

- `index.html`: text, publications, members, links, contact information
- `styles.css`: colors, layout, spacing, responsive design
- `script.js`: mobile menu and scroll animation
- `assets/ais-campus-pixel.png`: hero image
- `assets/favicon.svg`: browser icon

Search for `Replace`, `Insert`, `your-email`, and `href="#"` to find placeholders quickly.

## 3. Add a professor or member photo

1. Put the image in `assets`, for example `assets/professor.jpg`.
2. Replace the `portrait-placeholder` block in `index.html` with:

```html
<img class="professor-photo" src="assets/professor.jpg" alt="Professor Youngwook Yoon" />
```

3. Add this CSS to `styles.css`:

```css
.professor-photo {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border-radius: 16px;
  border: 8px solid white;
  box-shadow: var(--shadow);
}
```

## 4. Deploy through GitHub and Vercel

### Upload to GitHub

```bash
git init
git add .
git commit -m "Initial AIS Lab website"
git branch -M main
git remote add origin https://github.com/YOUR-ID/ais-lab-homepage.git
git push -u origin main
```

### Deploy to Vercel

1. Sign in to Vercel with GitHub.
2. Choose **Add New → Project**.
3. Import the `ais-lab-homepage` repository.
4. Framework preset: **Other**.
5. Leave Build Command empty and use the project root as the output directory.
6. Click **Deploy**.

Later, edit the files in VS Code and run:

```bash
git add .
git commit -m "Update website content"
git push
```

Vercel will redeploy the connected repository automatically.

## 5. Alternative: GitHub Pages

In the GitHub repository, go to **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.

## Suggested next edits

- Professor biography and photo
- Real publication titles and DOI links
- Student names and profile images
- Laboratory room and email address
- Google Scholar, ORCID, GitHub links
- Korean/English language switch
