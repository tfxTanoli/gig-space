import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Gigspace server running on http://localhost:${PORT}`));
