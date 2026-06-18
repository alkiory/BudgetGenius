export default function getColorBasedOnEndDate(endDate: string | Date): string {
  const today = new Date();
  const endDateDate = new Date(endDate);

  if (endDateDate < today) {
    return "bg-red-500"; // overdue
  } else if (
    endDateDate.getTime() - today.getTime() <
    7 * 24 * 60 * 60 * 1000
  ) {
    return "bg-orange-500"; // within a week
  } else if (
    endDateDate.getTime() - today.getTime() <
    30 * 24 * 60 * 60 * 1000
  ) {
    return "bg-yellow-500"; // within a month
  } else {
    return "bg-green-500"; // more than a month away
  }
}
