import { NextRequest } from 'next/server';
import { forwardSupportResource } from '@/lib/lexmacasto/support-proxy';

export async function POST(req: NextRequest) {
  return forwardSupportResource(req, 'phone', 'store', 'POST');
}
export async function PUT(req: NextRequest) {
  return forwardSupportResource(req, 'phone', 'update', 'PUT');
}
export async function DELETE(req: NextRequest) {
  return forwardSupportResource(req, 'phone', 'delete', 'DELETE');
}
export async function GET(req: NextRequest) {
  return forwardSupportResource(req, 'phone', 'list', 'GET');
}
