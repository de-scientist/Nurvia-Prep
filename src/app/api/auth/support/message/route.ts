import { NextRequest } from 'next/server';
import { forwardSupportResource } from '@/lib/lexmacasto/support-proxy';

export async function POST(req: NextRequest) {
  return forwardSupportResource(req, 'message', 'store', 'POST');
}
export async function PUT(req: NextRequest) {
  return forwardSupportResource(req, 'message', 'update', 'PUT');
}
export async function DELETE(req: NextRequest) {
  return forwardSupportResource(req, 'message', 'delete', 'DELETE');
}
export async function GET(req: NextRequest) {
  return forwardSupportResource(req, 'message', 'list', 'GET');
}
