export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInMs = now.getTime() - date.getTime();
	const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
	const diffInHours = Math.floor(diffInMinutes / 60);
	const diffInDays = Math.floor(diffInHours / 24);

	if (diffInMinutes < 1) {
		return 'just now';
	} else if (diffInMinutes < 60) {
		return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
	} else if (diffInHours < 24) {
		return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
	} else if (diffInDays < 7) {
		return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
	} else {
		return date.toLocaleDateString();
	}
}

export function formatDateTime(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleString();
}